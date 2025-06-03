import { getTenderlyDemoTokenBalance } from '@/lib/alchemy/get-token-balance'
import { getUserEvmWalletAddress, verifyAccessToken } from '@/lib/privy/client'
import { ethToWei, setBalanceVnet } from '@/lib/tenderly/fund'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const claims = await verifyAccessToken()
    
    if (!claims || !claims.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Get the user's EVM wallet address
    const walletAddress = await getUserEvmWalletAddress()
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'No wallet address found' },
        { status: 404 }
      )
    }
    
    // Get wallet balance on Tenderly Demo Network
    const tokenBalances = await getTenderlyDemoTokenBalance(walletAddress)
    
    // Find ETH balance
    const ethToken = tokenBalances.find(token => token.symbol === 'ETH')
    
    if (!ethToken) {
      return NextResponse.json(
        { error: 'ETH token not found in balance' },
        { status: 404 }
      )
    }
    
    const ethBalance = parseFloat(ethToken.balance)
    
    // If balance is less than 1 ETH, fund the wallet
    if (ethBalance < 0.1) {
      // Convert 1 ETH to wei (hex string)
      const oneEthInWei = ethToWei('1.0')
      
      // Fund the wallet using Tenderly's setBalanceVnet function
      const result = await setBalanceVnet([walletAddress], oneEthInWei)
      
      return NextResponse.json({
        success: true,
        walletAddress,
        previousBalance: ethBalance,
        funded: true,
        fundingResult: result
      })
    } else {
      // If balance is already sufficient, return success without funding
      return NextResponse.json({
        success: true,
        walletAddress,
        currentBalance: ethBalance,
        funded: false,
        message: 'Wallet already has sufficient balance (>= 1 ETH)'
      })
    }
  } catch (error: any) {
    console.error('Error in wallet funding API route:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred' },
      { status: 500 }
    )
  }
} 
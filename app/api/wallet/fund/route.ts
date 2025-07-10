import { getTokenBalances } from '@/lib/alchemy/get-token-balance';
import { TokenData } from '@/lib/types/wallet-token';
import { addBalanceAnvilFork } from '@/lib/anvil-fork/fund';
import { getUserEvmWalletAddress, verifyAccessToken } from '@/lib/privy/client';
import { ethToWei, setBalanceVnet } from '@/lib/tenderly/fund';
import { TENDERLY_DEMO_CONFIG } from '@/lib/network/config';
import { NextRequest, NextResponse } from 'next/server';

// Configuration constants
const FUNDING_THRESHOLD = 0.1; // ETH - minimum balance threshold
const FUNDING_AMOUNT = 1.0; // ETH - amount to fund the wallet with

export async function GET(req: NextRequest) {
  try {
    console.log('Wallet funding API called')
    
    // Verify user is authenticated
    const claims = await verifyAccessToken()
    
    if (!claims || !claims.userId) {
      console.error('Authentication required for wallet funding')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    console.log(`User authenticated: ${claims.userId}`)
    
    // Get the user's EVM wallet address
    const walletAddress = await getUserEvmWalletAddress()
    
    if (!walletAddress) {
      console.error('No wallet address found for authenticated user')
      return NextResponse.json(
        { error: 'No wallet address found' },
        { status: 404 }
      )
    }
    
    console.log(`User wallet address: ${walletAddress}`)
    
    // Get wallet balance on Tenderly Demo Network
    console.log('Fetching token balances from Tenderly Demo Network')
    const tokenBalances = await getTokenBalances(walletAddress, 1, true)
    console.log(`Found ${tokenBalances.length} tokens in wallet`)
    
    // Find ETH balance
    const ethToken = tokenBalances.find((token: TokenData) => token.symbol === 'ETH')
    
    if (!ethToken) {
      console.error('ETH token not found in balance response')
      return NextResponse.json(
        { error: 'ETH token not found in balance' },
        { status: 404 }
      )
    }
    
    const ethBalance = parseFloat(ethToken.balance)
    console.log(`Current ETH balance: ${ethBalance}`)
    
    // If balance is less than the funding threshold, fund the wallet
    if (ethBalance < FUNDING_THRESHOLD) {
      console.log(`Balance below threshold (${FUNDING_THRESHOLD} ETH), funding wallet with ${FUNDING_AMOUNT} ETH`)
      
      // Convert funding amount to wei (hex string)
      const fundingAmountInWei = ethToWei(FUNDING_AMOUNT.toString())
      let result;
      try {
        // Fund the wallet using Tenderly's setBalanceVnet function
        if (process.env.NEXT_PUBLIC_TEST_NET_ENV === "development" && TENDERLY_DEMO_CONFIG.rpcUrl.includes('tenderly')) {
          result = await setBalanceVnet([walletAddress], fundingAmountInWei)
        } else {
          result = await addBalanceAnvilFork(walletAddress, BigInt(fundingAmountInWei))
        }
        console.log('Funding successful:', result)
        
        return NextResponse.json({
          success: true,
          walletAddress,
          previousBalance: ethBalance,
          fundedAmount: FUNDING_AMOUNT,
          funded: true,
          fundingResult: result
        })
      } catch (fundingError: any) {
        console.error('Error in setBalanceVnet:', fundingError)
        return NextResponse.json(
          { 
            error: `Failed to fund wallet: ${fundingError.message}`,
            walletAddress,
            currentBalance: ethBalance
          },
          { status: 500 }
        )
      }
    } else {
      console.log(`Wallet already has sufficient balance (${ethBalance} ETH)`)
      // If balance is already sufficient, return success without funding
      return NextResponse.json({
        success: true,
        walletAddress,
        currentBalance: ethBalance,
        funded: false,
        message: `Wallet already has sufficient balance (>= ${FUNDING_THRESHOLD} ETH)`
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
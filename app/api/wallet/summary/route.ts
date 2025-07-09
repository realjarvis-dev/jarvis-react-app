import { getWalletSummary } from '@/lib/alchemy/transfers-sdk'
import { getUserEvmWalletAddress, privy } from '@/lib/privy/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const privyToken = request.cookies.get('privy-token')?.value
    
    if (!privyToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the token
    try {
      const claims = await privy.verifyAuthToken(privyToken)
      console.log('Wallet summary requested by user:', claims.userId)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get the user's wallet address
    const walletAddress = await getUserEvmWalletAddress()
    
    if (!walletAddress) {
      return NextResponse.json(
        { 
          indexed: false,
          error: 'No wallet address found for user'
        },
        { status: 404 }
      )
    }

    console.log('Fetching wallet summary for:', walletAddress)

    // Try to get wallet summary from Redis
    const walletSummary = await getWalletSummary(walletAddress)

    if (!walletSummary) {
      return NextResponse.json({
        indexed: false,
        walletAddress,
        message: 'Wallet is not indexed yet. Please click "Index Wallet" to analyze your transaction history.',
        suggestion: 'Use the "Index Wallet" button in Settings → Wallet to get personalized insights.'
      })
    }

    // Return the wallet summary if found
    return NextResponse.json({
      indexed: true,
      walletAddress,
      message: 'Wallet has been indexed and analyzed.',
      summary: walletSummary,
      analysis: {
        riskProfile: walletSummary.userPersona.riskProfile,
        confidence: Math.round(walletSummary.userPersona.confidence * 100),
        reasoning: walletSummary.userPersona.reasoning,
        topProtocols: walletSummary.protocolPreferences.topProtocols.slice(0, 3),
        primaryAssets: walletSummary.portfolioInsights.primaryAssets,
        activityPattern: walletSummary.portfolioInsights.activityPattern,
        tradingFrequency: walletSummary.behavioralPatterns.tradingFrequency,
        averageTransactionSize: walletSummary.behavioralPatterns.averageTransactionSize
      },
      quickSummary: walletSummary.summary
    })

  } catch (error) {
    console.error('Wallet summary API error:', error)
    
    return NextResponse.json(
      {
        indexed: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Also support getting summary for a specific wallet address via query parameter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddress } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required in request body' },
        { status: 400 }
      )
    }

    console.log('Fetching wallet summary for specified address:', walletAddress)

    // Try to get wallet summary from Redis
    const walletSummary = await getWalletSummary(walletAddress)

    if (!walletSummary) {
      return NextResponse.json({
        indexed: false,
        walletAddress,
        message: 'This wallet is not indexed yet.',
        note: 'Only indexed wallets have analysis data available.'
      })
    }

    // Return the wallet summary if found
    return NextResponse.json({
      indexed: true,
      walletAddress,
      message: 'Wallet analysis found.',
      summary: walletSummary,
      analysis: {
        riskProfile: walletSummary.userPersona.riskProfile,
        confidence: Math.round(walletSummary.userPersona.confidence * 100),
        reasoning: walletSummary.userPersona.reasoning,
        topProtocols: walletSummary.protocolPreferences.topProtocols.slice(0, 3),
        primaryAssets: walletSummary.portfolioInsights.primaryAssets,
        activityPattern: walletSummary.portfolioInsights.activityPattern,
        tradingFrequency: walletSummary.behavioralPatterns.tradingFrequency,
        averageTransactionSize: walletSummary.behavioralPatterns.averageTransactionSize
      },
      quickSummary: walletSummary.summary
    })

  } catch (error) {
    console.error('Wallet summary API error:', error)
    
    return NextResponse.json(
      {
        indexed: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
} 
import { indexUserWallet, WalletIndexingOptions } from '@/lib/alchemy/index-wallet'
import { getUserEvmWalletAddress, privy } from '@/lib/privy/client'
import { getRedisClient } from '@/lib/redis/config'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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
      console.log('Wallet indexing initiated by user:', claims.userId)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get options from request body if provided
    const body = await request.json().catch(() => ({}))
    const options: WalletIndexingOptions = {
      maxPages: body.maxPages || 3, // Conservative default for UI
      maxConcurrency: body.maxConcurrency || 2, // Conservative for API performance
      analysisModel: body.analysisModel || 'openai:gpt-4o-mini', // Use mini for faster response
      skipSaving: body.skipSaving || false, // Save by default
      fromBlock: body.fromBlock || '0x0'
    }

    // Handle additional wallet if provided
    let additionalWallet = body.additionalWallet
    
    // If no additional wallet in request, try to get from Redis
    if (!additionalWallet) {
      try {
        const walletAddress = await getUserEvmWalletAddress()
        if (walletAddress) {
          const redis = await getRedisClient()
          const additionalWalletKey = `wallet:additionalWallet:${walletAddress.toLowerCase()}`
          additionalWallet = await redis.get(additionalWalletKey)
        }
      } catch (error) {
        console.log('Could not retrieve additional wallet from Redis:', error)
      }
    } else {
      // If additional wallet provided, store it in Redis for future use
      try {
        const walletAddress = await getUserEvmWalletAddress()
        if (walletAddress) {
          const redis = await getRedisClient()
          const additionalWalletKey = `wallet:additionalWallet:${walletAddress.toLowerCase()}`
          if (additionalWallet.trim()) {
            await redis.set(additionalWalletKey, additionalWallet.trim())
          } else {
            await redis.del(additionalWalletKey)
          }
        }
      } catch (error) {
        console.warn('Could not store additional wallet in Redis:', error)
      }
    }

    // Add additional wallet to options if present
    if (additionalWallet && additionalWallet.trim()) {
      options.additionalWallet = additionalWallet.trim()
    }

    console.log('Starting wallet indexing with options:', options)

    // Call the wallet indexing function
    const result = await indexUserWallet(options)

    if (result.success) {
      console.log('Wallet indexing completed successfully')
      
      // Return success response with summary
      return NextResponse.json({
        success: true,
        message: 'Wallet indexed successfully',
        walletAddress: result.walletAddress,
        summary: {
          totalTransactions: result.processingStats?.totalTransactions || 0,
          pagesProcessed: result.processingStats?.pagesProcessed || 0,
          processingTime: {
            enrichment: result.processingStats?.enrichmentTime || 0,
            analysis: result.processingStats?.analysisTime || 0
          },
          riskProfile: result.analysis?.userPersona?.riskProfile || 'unknown',
          confidence: result.analysis?.userPersona?.confidence || 0
        }
      })
    } else {
      console.error('Wallet indexing failed:', result.error)
      
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Wallet indexing failed'
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Wallet indexing API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Simple endpoint to check if the service is available
  return NextResponse.json({
    message: 'Wallet indexing service is available',
    availableOptions: {
      maxPages: 'number (default: 3, max: 10)',
      maxConcurrency: 'number (default: 2, max: 5)',
      analysisModel: 'string (default: openai:gpt-4o-mini)',
      skipSaving: 'boolean (default: false)',
      fromBlock: 'string (default: 0x0)'
    }
  })
} 
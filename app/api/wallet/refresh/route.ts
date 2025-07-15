import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalances } from '@/lib/utils/wallet'
import { getUserEvmWalletAddress, getUserId } from '@/lib/privy/client'
import { balanceChangePub } from '@/lib/pubsub/balance-change-pub'

/**
 * POST /api/wallet/refresh
 * Manually refresh wallet balances by bypassing cache
 */
export async function POST(request: NextRequest) {
  try {
    // Get user information
    const userId = await getUserId()
    const userAddress = await getUserEvmWalletAddress()
    
    if (!userId || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Parse request body to get optional parameters
    const body = await request.json().catch(() => ({}))
    const { chainId = 1, isDemo = false } = body

    console.log(`Manual wallet refresh requested by user ${userId} for address ${userAddress}`)

    // Force refresh wallet balances by bypassing cache
    const result = await getWalletBalances(
      userAddress,
      undefined, // solana address - use default
      chainId,
      true // bypassCache = true
    )

    // Publish balance change event to update UI
    balanceChangePub(userId, ['ethereum'], isDemo)

    console.log(`Manual refresh completed: found ${result.tokens.length} tokens`)

    return NextResponse.json({
      success: true,
      message: 'Wallet balances refreshed successfully',
      tokenCount: result.tokens.length,
      networkErrors: result.networkErrors
    })

  } catch (error) {
    console.error('Manual wallet refresh failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/wallet/refresh
 * Simple GET endpoint for browser-based refresh
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
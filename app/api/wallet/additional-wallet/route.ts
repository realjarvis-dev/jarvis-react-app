import { getUserEvmWalletAddress, privy } from '@/lib/privy/client'
import { getRedisClient } from '@/lib/redis/config'
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
      await privy.verifyAuthToken(privyToken)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get user's wallet address
    const walletAddress = await getUserEvmWalletAddress()
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'User does not have an Ethereum wallet' },
        { status: 400 }
      )
    }

    // Get additional wallet address from Redis
    const redis = await getRedisClient()
    const additionalWalletKey = `wallet:additionalWallet:${walletAddress.toLowerCase()}`
    const additionalWallet = await redis.get(additionalWalletKey)

    return NextResponse.json({
      success: true,
      additionalWallet: additionalWallet || null
    })

  } catch (error) {
    console.error('Additional wallet GET API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

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
      await privy.verifyAuthToken(privyToken)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get user's wallet address
    const walletAddress = await getUserEvmWalletAddress()
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'User does not have an Ethereum wallet' },
        { status: 400 }
      )
    }

    // Get additional wallet from request body
    const body = await request.json()
    const additionalWallet = body.additionalWallet

    // Store additional wallet address in Redis
    const redis = await getRedisClient()
    const additionalWalletKey = `wallet:additionalWallet:${walletAddress.toLowerCase()}`
    
    if (additionalWallet && additionalWallet.trim()) {
      await redis.set(additionalWalletKey, additionalWallet.trim())
    } else {
      // If empty, remove the key
      await redis.del(additionalWalletKey)
    }

    return NextResponse.json({
      success: true,
      message: 'Additional wallet address saved successfully'
    })

  } catch (error) {
    console.error('Additional wallet POST API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
} 
import { getTrendingCoins } from '@/lib/coingecko/market-pulse'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const trendingCoins = await getTrendingCoins()
    return NextResponse.json({ coins: trendingCoins }, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=600, stale-while-revalidate=30', // 10 minutes
      },
    })
  } catch (err) {
    console.error('Error in market-pulse API:', err)
    return NextResponse.json({ error: 'Failed to fetch trending coins' }, { status: 500 })
  }
} 
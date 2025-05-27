import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const apiKey = process.env.COINGECKO_API_KEY
  const url = 'https://api.coingecko.com/api/v3/search/trending'
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-cg-demo-api-key': apiKey || '',
    },
  }

  try {
    const response = await fetch(url, options)
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=600, stale-while-revalidate=30', // 10 minutes
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch trending coins' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { fetchProtocols } from '@/lib/defillama/api'

export async function GET(request: NextRequest) {
  try {
    const protocols = await fetchProtocols()
    
    return NextResponse.json(
      { success: true, data: protocols },
      { 
        status: 200,
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
        }
      }
    )
  } catch (error) {
    console.error('Failed to fetch DeFiLlama protocols:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch protocols' 
      },
      { status: 500 }
    )
  }
}
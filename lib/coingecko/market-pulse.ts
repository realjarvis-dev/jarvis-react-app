/**
 * CoinGecko Market Pulse API functions
 * Provides trending cryptocurrency data
 */

export interface TrendingCoinData {
  id: string
  name: string
  shortName: string
  price: number
  priceChange24h: number
  trend: 'up' | 'down'
}

export interface TrendingCoinsResponse {
  coins: Array<{
    item: {
      id: string
      name: string
      symbol: string
      data: {
        price: number
        price_change_percentage_24h: {
          usd: number
        }
      }
    }
  }>
}

/**
 * Fetches trending coins data from CoinGecko API
 * @returns Promise<TrendingCoinsResponse>
 */
export async function fetchTrendingCoins(): Promise<TrendingCoinsResponse> {
  const apiKey = process.env.COINGECKO_API_KEY
  const baseUrl = 'https://api.coingecko.com/api/v3'
  
  const url = `${baseUrl}/search/trending`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(apiKey && { 'x-cg-demo-api-key': apiKey })
      },
      // Add timeout for better error handling
      signal: AbortSignal.timeout(10000) // 10 seconds timeout
    })

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Validate response structure
    if (!data.coins || !Array.isArray(data.coins)) {
      throw new Error('Invalid response format from CoinGecko API')
    }

    return data as TrendingCoinsResponse
  } catch (error) {
    console.error('Error fetching trending coins:', error)
    throw error
  }
}

/**
 * Processes raw trending coins data into a more usable format
 * @param rawData - Raw response from CoinGecko API
 * @returns TrendingCoinData[]
 */
export function processTrendingCoinsData(
  rawData: TrendingCoinsResponse
): TrendingCoinData[] {
  return rawData.coins.map((coin) => {
    const priceChange = coin.item.data.price_change_percentage_24h.usd
    return {
      id: coin.item.id,
      name: coin.item.name,
      shortName: coin.item.symbol,
      price: coin.item.data.price,
      priceChange24h: priceChange,
      trend: priceChange >= 0 ? 'up' : 'down',
    }
  })
}

/**
 * Convenience function to get processed trending coins data
 * @returns Promise<TrendingCoinData[]>
 */
export async function getTrendingCoins(): Promise<TrendingCoinData[]> {
  const rawData = await fetchTrendingCoins()
  return processTrendingCoinsData(rawData)
}

 
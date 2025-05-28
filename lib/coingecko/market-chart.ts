/**
 * CoinGecko Market Chart API functions
 * Provides historical market data for cryptocurrencies
 */

export interface MarketChartDataPoint {
  timestamp: number // Unix timestamp in milliseconds
  price: number
  marketCap: number
  volume: number
}

export interface MarketChartResponse {
  prices: [number, number][] // [timestamp, price]
  market_caps: [number, number][] // [timestamp, market_cap]
  total_volumes: [number, number][] // [timestamp, volume]
}

export interface ProcessedMarketData {
  data: MarketChartDataPoint[]
  coinId: string
  currency: string
  days: number
}

/**
 * Fetches historical market chart data from CoinGecko API
 * @param coinId - The CoinGecko coin ID (e.g., 'bitcoin', 'ethereum')
 * @param days - Number of days of historical data (default: 7)
 * @param currency - Target currency (default: 'usd')
 * @returns Promise<MarketChartResponse>
 */
export async function fetchMarketChart(
  coinId: string,
  days: number = 7,
  currency: string = 'usd'
): Promise<MarketChartResponse> {
  const apiKey = process.env.COINGECKO_API_KEY
  const baseUrl = 'https://api.coingecko.com/api/v3'
  
  const url = `${baseUrl}/coins/${coinId}/market_chart`
  const params = new URLSearchParams({
    vs_currency: currency,
    days: days.toString(),
    ...(apiKey && { 'x-cg-demo-api-key': apiKey })
  })

  try {
    const response = await fetch(`${url}?${params}`, {
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
    if (!data.prices || !data.market_caps || !data.total_volumes) {
      throw new Error('Invalid response format from CoinGecko API')
    }

    return data as MarketChartResponse
  } catch (error) {
    console.error('Error fetching market chart data:', error)
    throw error
  }
}

/**
 * Processes raw market chart data into a more usable format
 * @param rawData - Raw response from CoinGecko API
 * @param coinId - The coin ID for reference
 * @param currency - The currency used
 * @param days - Number of days requested
 * @returns ProcessedMarketData
 */
export function processMarketChartData(
  rawData: MarketChartResponse,
  coinId: string,
  currency: string,
  days: number
): ProcessedMarketData {
  const data: MarketChartDataPoint[] = []

  // Ensure all arrays have the same length
  const minLength = Math.min(
    rawData.prices.length,
    rawData.market_caps.length,
    rawData.total_volumes.length
  )

  for (let i = 0; i < minLength; i++) {
    data.push({
      timestamp: rawData.prices[i][0],
      price: rawData.prices[i][1],
      marketCap: rawData.market_caps[i][1],
      volume: rawData.total_volumes[i][1]
    })
  }

  return {
    data,
    coinId,
    currency,
    days
  }
}

/**
 * Convenience function to get processed market data for the last 7 days (hourly)
 * @param coinId - The CoinGecko coin ID
 * @param currency - Target currency (default: 'usd')
 * @returns Promise<ProcessedMarketData>
 */
export async function getHourlyMarketData(
  coinId: string,
  currency: string = 'usd'
): Promise<ProcessedMarketData> {
  const days = 7 // Last 7 days gives hourly data
  const rawData = await fetchMarketChart(coinId, days, currency)
  return processMarketChartData(rawData, coinId, currency, days)
}

/**
 * Formats timestamp to human-readable date string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

/**
 * Formats price with appropriate decimal places
 * @param price - Price value
 * @returns Formatted price string
 */
export function formatPrice(price: number): string {
  if (price >= 100) {
    return price.toFixed(2)
  } else if (price >= 1) {
    return price.toFixed(4)
  } else {
    return price.toPrecision(4)
  }
}

/**
 * Formats market cap or volume with appropriate units
 * @param value - Market cap or volume value
 * @returns Formatted string with units
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
} 
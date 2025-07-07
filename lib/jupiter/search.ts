import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'

// Create a new axios instance for Jupiter API with its own cache
const jupiterAxios = axios.create()
const cachedJupiterAxios = setupCache(jupiterAxios, {
  ttl: 10 * 60 * 1000, // 10 minutes cache
  interpretHeader: false, // Don't use cache-control headers
  methods: ['get'] // Only cache GET requests
})

// a simplified interface for the xstock data
export interface JupiterTokenData {
  id: string
  name: string
  symbol: string
  icon: string
  decimals: number
  mcap: number
  usdPrice: number
  liquidity: number
  stats5m: {
    priceChange: number
  }
  stats1h: {
    priceChange: number
  }
  stats24h: {
    priceChange: number
  }
}

/**
 * Search for token metadata via Jupiter's Token API v2
 * @param mintAddress - Mint address
 * @returns Array of token metadata objects
 */
export async function searchTokens(mintAddress: string) {
  try {
    const response = await cachedJupiterAxios.get(
      'https://lite-api.jup.ag/tokens/v2/search',
      {
        params: { query: mintAddress }
      }
    )
    return response.data
  } catch (error) {
    console.error('Error fetching token metadata:', error)
    throw error
  }
}

export async function searchXStocksByName(name: string): Promise<JupiterTokenData[]> {
  try {
    const response = await cachedJupiterAxios.get(
      'https://lite-api.jup.ag/tokens/v2/search',
      {
        params: { query: name }
      }
    )

    // Filter tokens to only include those with "xstocks" tag
    const tokens = response.data
    const xstocksTokens = tokens.filter(
      (token: any) => token.tags && token.tags.includes('xstocks')
    )

    return xstocksTokens
  } catch (error) {
    console.error('Error searching XStocks by name:', error)
    throw error
  }
}


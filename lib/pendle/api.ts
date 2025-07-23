import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'
import {
  PendleMarket,
  PendleResponse,
  SimplifiedPendleMarket
} from '../types/pendle'

// Base URLs for Pendle APIs
const BASE_URL = 'https://api-v2.pendle.finance/core'

// Create a new axios instance for Pendle API with its own cache
const pendleAxios = axios.create()
const cachedPendleAxios = setupCache(pendleAxios, {
  ttl: 60 * 60 * 1000, // 1 hour cache
  interpretHeader: false, // Don't use cache-control headers
  methods: ['get'] // Only cache GET requests
})

/**
 * Fetches active markets from Pendle API for specified chain
 * @param chainId - The chain ID to fetch markets for
 * @returns Promise<PendleResponse>
 */
export async function fetchPendleMarkets(
  chainId: number
): Promise<PendleResponse> {
  try {
    const response = await cachedPendleAxios.get(
      `${BASE_URL}/v1/${chainId}/markets/active`,
      {
        timeout: 10000 // 10 seconds timeout
      }
    )

    if (!response.data) {
      throw new Error(`Pendle API error: No data returned`)
    }

    return response.data as PendleResponse
  } catch (error) {
    console.error('Error fetching Pendle markets:', error)
    throw error
  }
}

/**
 * Fetches inactive markets from Pendle API for specified chain
 * @param chainId - The chain ID to fetch markets for
 * @returns Promise<PendleResponse>
 */
export async function fetchInactivePendleMarkets(
  chainId: number
): Promise<PendleResponse> {
  try {
    const response = await cachedPendleAxios.get(
      `${BASE_URL}/v1/${chainId}/markets/inactive`,
      {
        timeout: 10000 // 10 seconds timeout
      }
    )

    if (!response.data) {
      throw new Error(`Pendle API error: No data returned for inactive markets`)
    }

    return response.data as PendleResponse
  } catch (error) {
    console.error('Error fetching inactive Pendle markets:', error)
    throw error
  }
}

/**
 * Processes Pendle markets data to extract required information
 * @param markets Array of PendleMarket
 * @param active Whether these markets are active or not
 * @returns Array of SimplifiedPendleMarket
 */
export function processPendleMarkets(
  markets: PendleMarket[],
  active: boolean = true
): SimplifiedPendleMarket[] {
  return markets.map(market => {
    // Helper function to remove chainId prefix from addresses if present
    const cleanAddress = (address: string): string => {
      // Remove common chainId prefixes: "1-" (Ethereum), "8453-" (Base), etc.
      const prefixMatch = address.match(/^(\d+)-(.+)$/)
      return prefixMatch ? prefixMatch[2] : address
    }

    // Clean all addresses that might have chainId prefixes
    const ptAddress = cleanAddress(market.pt)
    const ytAddress = cleanAddress(market.yt)
    const syAddress = cleanAddress(market.sy)
    const underlyingAssetAddress = cleanAddress(market.underlyingAsset)

    return {
      name: market.name,
      address: market.address,
      expiry: market.expiry,
      pt: ptAddress,
      yt: ytAddress,
      sy: syAddress,
      underlyingAsset: underlyingAssetAddress,
      liquidity: market.details.liquidity,
      impliedApy: market.details.impliedApy,
      active: active,
      isNew: market.isNew,
      timestamp: market.timestamp
    }
  })
}

/**
 * Fetches and processes Pendle markets data based on filter
 * @param filter Filter to apply: 'active', 'inactive', or 'all'
 * @param chainId - The chain ID to fetch markets for
 * @returns Promise<SimplifiedPendleMarket[]>
 */
export async function getPendleMarkets(
  filter: 'active' | 'inactive' | 'all' = 'active',
  chainId: number
): Promise<SimplifiedPendleMarket[]> {
  if (filter === 'active') {
    const activeResponse = await fetchPendleMarkets(chainId)
    return processPendleMarkets(activeResponse.markets, true)
  } else if (filter === 'inactive') {
    const inactiveResponse = await fetchInactivePendleMarkets(chainId)
    return processPendleMarkets(inactiveResponse.markets, false)
  } else {
    // For 'all' filter
    const activeResponse = await fetchPendleMarkets(chainId)
    const inactiveResponse = await fetchInactivePendleMarkets(chainId)

    const activeMarkets = processPendleMarkets(activeResponse.markets, true)
    const inactiveMarkets = processPendleMarkets(
      inactiveResponse.markets,
      false
    )

    return [...activeMarkets, ...inactiveMarkets]
  }
}

export async function getListPendleAddress(chainId: number) {
  const markets = await getPendleMarkets('active', chainId)
  markets.sort((a, b) => b.impliedApy - a.impliedApy)
  console.log(markets)
  const listPendleAddress = []
  for (const market of markets) {
    listPendleAddress.push(market.address)
    listPendleAddress.push(market.pt)
    listPendleAddress.push(market.yt)
    listPendleAddress.push(market.sy)
  }
  return listPendleAddress
}

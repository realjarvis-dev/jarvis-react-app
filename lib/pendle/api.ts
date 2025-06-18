import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'
import {
  PendleMarket,
  PendleResponse,
  SimplifiedPendleMarket
} from '../types/pendle'

// Base URLs for Pendle APIs
const BASE_URL = 'https://api-v2.pendle.finance/core'
const CHAIN_ID = 1 // Ethereum mainnet

// Create cached axios instance
const cachedAxios = setupCache(axios, {
  ttl: 60 * 60 * 1000, // 1 hour cache
  interpretHeader: false, // Don't use cache-control headers
  methods: ['get'] // Only cache GET requests
})

/**
 * Fetches active markets from Pendle API for Ethereum chain
 * @returns Promise<PendleResponse>
 */
export async function fetchPendleMarkets(): Promise<PendleResponse> {
  try {
    const response = await cachedAxios.get(
      `${BASE_URL}/v1/${CHAIN_ID}/markets/active`,
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
 * Fetches inactive markets from Pendle API for Ethereum chain
 * @returns Promise<PendleResponse>
 */
export async function fetchInactivePendleMarkets(): Promise<PendleResponse> {
  try {
    const response = await cachedAxios.get(
      `${BASE_URL}/v1/${CHAIN_ID}/markets/inactive`,
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
    // Remove "1-" prefix from PT and YT token addresses if present
    const ptAddress = market.pt.startsWith('1-')
      ? market.pt.substring(2)
      : market.pt
    const ytAddress = market.yt.startsWith('1-')
      ? market.yt.substring(2)
      : market.yt

    return {
      name: market.name,
      address: market.address,
      expiry: market.expiry,
      pt: ptAddress,
      yt: ytAddress,
      sy: market.sy.replace('1-', ''),
      underlyingAsset: market.underlyingAsset.replace('1-', ''),
      liquidity: market.details.liquidity,
      impliedApy: market.details.impliedApy,
      active: active
    }
  })
}

/**
 * Fetches and processes Pendle markets data based on filter
 * @param filter Filter to apply: 'active', 'inactive', or 'all'
 * @returns Promise<SimplifiedPendleMarket[]>
 */
export async function getPendleMarkets(
  filter: 'active' | 'inactive' | 'all' = 'active'
): Promise<SimplifiedPendleMarket[]> {
  if (filter === 'active') {
    const activeResponse = await fetchPendleMarkets()
    return processPendleMarkets(activeResponse.markets, true)
  } else if (filter === 'inactive') {
    const inactiveResponse = await fetchInactivePendleMarkets()
    return processPendleMarkets(inactiveResponse.markets, false)
  } else {
    // For 'all' filter
    const activeResponse = await fetchPendleMarkets()
    const inactiveResponse = await fetchInactivePendleMarkets()

    const activeMarkets = processPendleMarkets(activeResponse.markets, true)
    const inactiveMarkets = processPendleMarkets(
      inactiveResponse.markets,
      false
    )

    return [...activeMarkets, ...inactiveMarkets]
  }
}

export async function getListPendleAddress() {
  const markets = await getPendleMarkets()
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

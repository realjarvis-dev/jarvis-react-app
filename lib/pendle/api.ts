import axios from 'axios'
import { PendleMarket, PendleResponse, SimplifiedPendleMarket } from '../types/pendle'

// Base URLs for Pendle APIs
const BASE_URL = 'https://api-v2.pendle.finance/core'
const CHAIN_ID = 1 // Ethereum mainnet

/**
 * Fetches active markets from Pendle API for Ethereum chain
 * @returns Promise<PendleResponse>
 */
export async function fetchPendleMarkets(): Promise<PendleResponse> {
  try {
    const response = await axios.get(`${BASE_URL}/v1/${CHAIN_ID}/markets/active`, {
      timeout: 10000 // 10 seconds timeout
    })
    
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
    const response = await axios.get(`${BASE_URL}/v1/${CHAIN_ID}/markets/inactive`, {
      timeout: 10000 // 10 seconds timeout
    })
    
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
export function processPendleMarkets(markets: PendleMarket[], active: boolean = true): SimplifiedPendleMarket[] {
  return markets.map(market => {
    // Helper function to remove "1-" prefix from addresses if present
    const cleanAddress = (address: string): string => {
      return address.startsWith('1-') ? address.substring(2) : address;
    };

    // Clean all addresses that might have the "1-" prefix
    const ptAddress = cleanAddress(market.pt);
    const ytAddress = cleanAddress(market.yt);
    const syAddress = cleanAddress(market.sy);
    const underlyingAssetAddress = cleanAddress(market.underlyingAsset);

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
      active: active
    };
  });
}

/**
 * Fetches and processes Pendle markets data based on filter
 * @param filter Filter to apply: 'active', 'inactive', or 'all'
 * @returns Promise<SimplifiedPendleMarket[]>
 */
export async function getPendleMarkets(filter: 'active' | 'inactive' | 'all' = 'active'): Promise<SimplifiedPendleMarket[]> {
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
    const inactiveMarkets = processPendleMarkets(inactiveResponse.markets, false)
    
    return [...activeMarkets, ...inactiveMarkets]
  }
} 
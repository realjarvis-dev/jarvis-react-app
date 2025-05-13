import axios from 'axios'
import { PendleMarket, PendleResponse, SimplifiedPendleMarket } from '../types/pendle'

// Base URLs for Pendle APIs
const BASE_URL = 'https://api-v2.pendle.finance/core'
const CHAIN_ID = 1 // Ethereum mainnet

/**
 * Fetches all markets from Pendle API for Ethereum chain
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
 * Processes Pendle markets data to extract required information
 * @param markets Array of PendleMarket
 * @returns Array of SimplifiedPendleMarket
 */
export function processPendleMarkets(markets: PendleMarket[]): SimplifiedPendleMarket[] {
  return markets.map(market => {
    // Remove "1-" prefix from PT and YT token addresses if present
    const ptAddress = market.pt.startsWith('1-') ? market.pt.substring(2) : market.pt;
    const ytAddress = market.yt.startsWith('1-') ? market.yt.substring(2) : market.yt;

    return {
      name: market.name,
      address: market.address,
      expiry: market.expiry,
      pt: ptAddress,
      yt: ytAddress,
      sy: market.sy,
      underlyingAsset: market.underlyingAsset,
      liquidity: market.details.liquidity,
      impliedApy: market.details.impliedApy
    };
  });
}

/**
 * Fetches and processes Pendle markets data
 * @returns Promise<SimplifiedPendleMarket[]>
 */
export async function getPendleMarkets(): Promise<SimplifiedPendleMarket[]> {
  const response = await fetchPendleMarkets()
  return processPendleMarkets(response.markets)
} 
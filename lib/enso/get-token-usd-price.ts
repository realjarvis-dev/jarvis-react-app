import { PriceApiResponse, TokenPrice } from '@/lib/types/token-price'
import axios from 'axios'

// Enso-specific token price type that extends the common interface
export interface EnsoTokenPrice extends TokenPrice {
  decimals: number
  symbol: string
  timestamp: number
  confidence: number
  chainId: number
}

export type EnsoResponseType = PriceApiResponse<EnsoTokenPrice>

// Known supported chainIds by Enso Finance API (common ones)
const SUPPORTED_CHAIN_IDS = [1, 137, 56, 43114, 250, 42161, 10, 8453, 100, 1284, 1285]

export async function getTokenUsdPriceBatch(
  tokenAddresses: string[],
  chainId: number
): Promise<EnsoTokenPrice[]> {
  try {
    // Check if we have any token addresses to fetch
    if (!tokenAddresses || tokenAddresses.length === 0) {
      console.warn('No token addresses provided for price fetching')
      return []
    }

    // Check if API key is configured
    if (!process.env.ENSO_API_KEY) {
      console.warn('ENSO_API_KEY not configured')
      return []
    }

    // Check if chainId is likely supported
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      console.warn(`ChainId ${chainId} may not be supported by Enso Finance API`)
      return []
    }

    console.log(`Fetching prices for ${tokenAddresses.length} tokens on chainId ${chainId}`)
    
    const response: EnsoResponseType = await axios.get(
      `https://api.enso.finance/api/v1/prices/${chainId}`,
      {
        params: {
          addresses: tokenAddresses.join(',')
        },
        headers: {
          Authorization: `Bearer ${process.env.ENSO_API_KEY}`
        }
      }
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Enso API error for chainId ${chainId}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })
      
      // Check if it's a chainId not supported error
      if (error.response?.status === 400) {
        console.warn(`ChainId ${chainId} is not supported by Enso Finance API`)
      }
    } else {
      console.error(`Unexpected error fetching token prices from Enso for chainId ${chainId}:`, error)
    }
    
    // Return empty array on error to allow graceful degradation
    return []
  }
}

// console.log(await getTokenUsdPriceBatch(['0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', '0x6b175474e89094c44da98b954eedeac495271d0f'], 1))

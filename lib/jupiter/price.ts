import { TokenPrice } from '@/lib/types/token-price'
import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'

// Create a new axios instance for Jupiter API with its own cache
const jupiterAxios = axios.create()
const cachedJupiterAxios = setupCache(jupiterAxios, {
  ttl: 1 * 60 * 1000, // 1 minutes cache
  interpretHeader: false, // Don't use cache-control headers
  methods: ['get'] // Only cache GET requests
})

// Jupiter-specific token price type
export interface JupiterTokenPrice extends TokenPrice {
  blockId: number
  decimals: number
  priceChange24h: number
  usdPrice: number
}

// Jupiter price API response type
export interface JupiterPriceResponse {
  [key: string]: JupiterTokenPrice
}

/**
 * Get token prices from Jupiter Price API v3
 * @param tokenAddresses Array of token addresses (mint addresses for Solana)
 * @param vsToken The token to price against (default: 'USDC')
 * @returns Array of token prices
 */
export async function getJupiterTokenPrices(
  tokenAddresses: string[],
): Promise<JupiterTokenPrice[]> {
  try {
    const response = await cachedJupiterAxios.get<JupiterPriceResponse>(
      'https://lite-api.jup.ag/price/v3',
      {
        params: {
          ids: tokenAddresses.join(',')
        }
      }
    )

    const prices: JupiterTokenPrice[] = []
    for (const tokenAddress of tokenAddresses) {
      const value = response.data[tokenAddress]
      if (value) {
        prices.push({
            address: tokenAddress,
            price: value.usdPrice,
            decimals: value.decimals,
            blockId: value.blockId,
            priceChange24h: value.priceChange24h,
            usdPrice: value.usdPrice
        })
      }
    }
    return prices
  } catch (error) {
    console.error('Error fetching Jupiter token prices:', error)
    throw new Error('Failed to fetch token prices from Jupiter')
  }
}


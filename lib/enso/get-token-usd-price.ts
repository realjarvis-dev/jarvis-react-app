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

export async function getTokenUsdPriceBatch(
  tokenAddresses: string[],
  chainId: number
): Promise<EnsoTokenPrice[]> {
  const response: EnsoResponseType = await axios.get(
    `https://api.enso.finance/api/v1/prices/${chainId}`,
    {
      params: {
        addresses: tokenAddresses
      },
      headers: {
        Authorization: `Bearer ${process.env.ENSO_API_KEY}`
      }
    }
  )
  return response.data
}

// console.log(await getTokenUsdPriceBatch(['0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', '0x6b175474e89094c44da98b954eedeac495271d0f'], 1))

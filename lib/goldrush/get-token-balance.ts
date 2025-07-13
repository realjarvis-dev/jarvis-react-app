import axios from 'axios'
import { TokenData } from '../types/wallet-token'

interface GoldRushTokenBalance {
  contract_decimals: number
  contract_name: string
  contract_ticker_symbol: string
  contract_address: string
  supports_erc?: string[]
  logo_url?: string
  balance: string
  balance_24h?: string
  quote?: number
  quote_24h?: number
  quote_rate?: number
  quote_rate_24h?: number
  nft_data?: any
  is_spam?: boolean
  pretty_quote?: string
}

interface GoldRushResponse {
  data: {
    address: string
    updated_at: string
    next_update_at: string
    quote_currency: string
    chain_id: number
    chain_name: string
    items: GoldRushTokenBalance[]
    pagination?: {
      has_more: boolean
      page_number: number
      page_size: number
      total_count?: number
    }
  }
  error: boolean
  error_message?: string
  error_code?: number
}

/**
 * Get token balances using GoldRush (Covalent) API
 * Supports Mantle network and many others that Alchemy doesn't fully support
 */
export async function getGoldRushTokenBalances(
  walletAddress: string,
  chainId: number,
  networkDisplayName: string
): Promise<TokenData[]> {
  try {
    if (!process.env.GOLDRUSH_API_KEY) {
      console.warn('GOLDRUSH_API_KEY not configured')
      return []
    }

    console.log(`Fetching token balances from GoldRush for ${networkDisplayName} (chainId: ${chainId})`)

    const response = await axios.get<GoldRushResponse>(
      `https://api.covalenthq.com/v1/${chainId}/address/${walletAddress}/balances_v2/`,
      {
        params: {
          'key': process.env.GOLDRUSH_API_KEY,
          'nft': false, // Only get fungible tokens
          'no-nft-fetch': true,
          'format': 'JSON'
        },
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (response.data.error) {
      console.error(`GoldRush API error: ${response.data.error_message}`)
      return []
    }

    const tokens: TokenData[] = response.data.data.items
      .filter(token => !token.is_spam && parseFloat(token.balance) > 0)
      .map(token => {
        // Calculate balance in human readable format
        const balance = (parseFloat(token.balance) / Math.pow(10, token.contract_decimals)).toString()
        
        return {
          address: token.contract_address,
          name: token.contract_name,
          symbol: token.contract_ticker_symbol,
          balance,
          network: networkDisplayName,
          decimals: token.contract_decimals
        }
      })
      .filter(token => parseFloat(token.balance) > 0) // Only return tokens with positive balance

    console.log(`Found ${tokens.length} tokens via GoldRush for ${networkDisplayName}`)
    return tokens

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`GoldRush API error for chainId ${chainId}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })
    } else {
      console.error(`Unexpected error fetching token balances from GoldRush for chainId ${chainId}:`, error)
    }
    return []
  }
}

/**
 * Check if GoldRush supports a specific chainId
 * Based on their supported networks: https://www.covalenthq.com/docs/networks/
 */
export function isGoldRushSupported(chainId: number): boolean {
  // Known supported chainIds by GoldRush/Covalent
  const supportedChainIds = [
    1,     // Ethereum Mainnet
    137,   // Polygon
    56,    // BSC
    43114, // Avalanche
    250,   // Fantom
    42161, // Arbitrum One
    10,    // Optimism
    8453,  // Base
    5000,  // Mantle
    1284,  // Moonbeam
    1285,  // Moonriver
    25,    // Cronos
    199,   // BitTorrent Chain
    324,   // zkSync Era
    59144, // Linea
    534352,// Scroll
    1101,  // Polygon zkEVM
    1313161554, // Aurora
    // Add more as needed
  ]
  
  return supportedChainIds.includes(chainId)
}

/**
 * Get complete wallet balances using GoldRush API as fallback
 * This is used when Alchemy doesn't support the network or Enhanced APIs
 */
export async function getGoldRushWalletBalances(
  walletAddress: string,
  chainId: number,
  networkDisplayName: string
): Promise<TokenData[]> {
  // Check if GoldRush supports this network
  if (!isGoldRushSupported(chainId)) {
    console.warn(`ChainId ${chainId} is not supported by GoldRush API`)
    return []
  }

  return await getGoldRushTokenBalances(walletAddress, chainId, networkDisplayName)
}
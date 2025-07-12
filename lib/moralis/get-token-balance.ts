import axios from 'axios'
import { TokenData } from '../types/wallet-token'

interface MoralisTokenBalance {
  token_address: string
  name: string
  symbol: string
  logo?: string
  thumbnail?: string
  decimals: number
  balance: string
  possible_spam: boolean
  verified_contract: boolean
  total_supply?: string
  percentage_relative_to_total_supply?: number
}

interface MoralisResponse {
  result: MoralisTokenBalance[]
  page: number
  page_size: number
  cursor?: string
}

/**
 * Get ERC-20 token balances using Moralis API
 * Useful for networks not fully supported by Alchemy (like Mantle)
 */
export async function getMoralisTokenBalances(
  walletAddress: string,
  chainId: number,
  networkDisplayName: string
): Promise<TokenData[]> {
  try {
    if (!process.env.MORALIS_API_KEY) {
      console.warn('MORALIS_API_KEY not configured')
      return []
    }

    console.log(`Fetching token balances from Moralis for ${networkDisplayName} (chainId: ${chainId})`)

    const response = await axios.get<MoralisResponse>(
      `https://deep-index.moralis.io/api/v2/${walletAddress}/erc20`,
      {
        params: {
          chain: `0x${chainId.toString(16)}`, // Convert to hex format
          exclude_spam: true,
          exclude_unverified_contracts: false
        },
        headers: {
          'X-API-Key': process.env.MORALIS_API_KEY,
          'Accept': 'application/json'
        }
      }
    )

    const tokens: TokenData[] = response.data.result
      .filter(token => !token.possible_spam && token.verified_contract)
      .map(token => ({
        address: token.token_address,
        name: token.name,
        symbol: token.symbol,
        balance: (parseInt(token.balance) / Math.pow(10, token.decimals)).toString(),
        network: networkDisplayName,
        decimals: token.decimals
      }))
      .filter(token => parseFloat(token.balance) > 0) // Only return tokens with positive balance

    console.log(`Found ${tokens.length} ERC-20 tokens via Moralis for ${networkDisplayName}`)
    return tokens

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Moralis API error for chainId ${chainId}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })
    } else {
      console.error(`Unexpected error fetching token balances from Moralis for chainId ${chainId}:`, error)
    }
    return []
  }
}

/**
 * Get native token balance using Moralis API
 */
export async function getMoralisNativeBalance(
  walletAddress: string,
  chainId: number,
  nativeAsset: { name: string, symbol: string, decimals: number },
  networkDisplayName: string
): Promise<TokenData | null> {
  try {
    if (!process.env.MORALIS_API_KEY) {
      console.warn('MORALIS_API_KEY not configured')
      return null
    }

    const response = await axios.get(
      `https://deep-index.moralis.io/api/v2/${walletAddress}/balance`,
      {
        params: {
          chain: `0x${chainId.toString(16)}`
        },
        headers: {
          'X-API-Key': process.env.MORALIS_API_KEY,
          'Accept': 'application/json'
        }
      }
    )

    const balanceWei = response.data.balance
    const balance = (parseInt(balanceWei) / Math.pow(10, nativeAsset.decimals)).toString()

    return {
      address: '0x0000000000000000000000000000000000000000', // Zero address for native token
      name: nativeAsset.name,
      symbol: nativeAsset.symbol,
      balance,
      network: networkDisplayName,
      decimals: nativeAsset.decimals
    }

  } catch (error) {
    console.error(`Error fetching native balance from Moralis for chainId ${chainId}:`, error)
    return null
  }
}

/**
 * Get complete wallet balances (native + ERC-20) using Moralis API
 * This is a fallback for networks not fully supported by Alchemy
 */
export async function getMoralisWalletBalances(
  walletAddress: string,
  chainId: number,
  nativeAsset: { name: string, symbol: string, decimals: number },
  networkDisplayName: string
): Promise<TokenData[]> {
  const results: TokenData[] = []

  // Get native balance
  const nativeBalance = await getMoralisNativeBalance(walletAddress, chainId, nativeAsset, networkDisplayName)
  if (nativeBalance && parseFloat(nativeBalance.balance) > 0) {
    results.push(nativeBalance)
  }

  // Get ERC-20 token balances
  const erc20Balances = await getMoralisTokenBalances(walletAddress, chainId, networkDisplayName)
  results.push(...erc20Balances)

  return results
}
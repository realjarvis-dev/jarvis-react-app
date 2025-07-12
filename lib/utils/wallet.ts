import { ethers } from 'ethers'
import { getTokenBalances } from '../alchemy/get-token-balance'
import { TokenData } from '../types/wallet-token'
import { getTokenBalances as getTokenBalancesSolana } from '../helius/get-token-balance'
import { allNetworkConfigs, TENDERLY_DEMO_CONFIG } from '../network/config'
import { NetworkConfig } from '../network/types'
import { getPendleMarkets } from '../pendle/api'
import { getUserEvmWalletAddress, getUserSolWalletAddress } from '../privy/client'

// Error handling wrapper for EVM token balances
async function getTokenBalancesWithErrorHandling(
  walletAddress: string,
  chainId: number,
  isDemo: boolean,
  networkName: string
): Promise<{ tokens: TokenData[], network: string, error?: string }> {
  try {
    const tokens = await getTokenBalances(walletAddress, chainId, isDemo)
    return { tokens, network: networkName }
  } catch (error) {
    console.error(`Error fetching balances for ${networkName}:`, error)
    return {
      tokens: [],
      network: networkName,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// Error handling wrapper for Solana token balances
async function getTokenBalancesSolanaWithErrorHandling(
  walletAddress: string,
  networkName: string
): Promise<{ tokens: TokenData[], network: string, error?: string }> {
  try {
    // Check if Helius API key is available
    if (!process.env.HELIUS_API_KEY) {
      return {
        tokens: [],
        network: networkName,
        error: 'Helius API key not configured'
      }
    }
    const tokens = await getTokenBalancesSolana(walletAddress)
    return { tokens, network: networkName }
  } catch (error) {
    console.error(`Error fetching Solana balances:`, error)
    return {
      tokens: [],
      network: networkName,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export interface WalletBalanceResult {
  tokens: TokenData[]
  networkErrors?: { network: string, error: string }[]
}


// Main function to get all token balances
export async function getWalletBalances(
  walletAddressParam?: string,
  solanaWalletAddressParam?: string,
  chainId: number = 1 // used for pendle markets
): Promise<WalletBalanceResult> {
  // Use provided wallet address or environment variable
  const walletAddress = walletAddressParam || (await getUserEvmWalletAddress())
  const solanaWalletAddress = solanaWalletAddressParam || (await getUserSolWalletAddress())
  if (!walletAddress) {
    throw new Error(
      'No wallet address provided and user does not have EVM wallet.'
    )
  }
  if (!solanaWalletAddress) {
    throw new Error(
      'No solana wallet address provided and user does not have Solana wallet.'
    )
  }

  try {
    const tokenDataPromises: Promise<{ tokens: TokenData[], network: string, error?: string }>[] = []

    // Add promises for all networks in allNetworkConfigs with error handling
    Object.values(allNetworkConfigs).forEach((network: NetworkConfig) => {
      if (network.id === "solana") {
        tokenDataPromises.push(
          getTokenBalancesSolanaWithErrorHandling(solanaWalletAddress, network.displayName)
        )
      } else {
        tokenDataPromises.push(
          getTokenBalancesWithErrorHandling(walletAddress, network.chainId, network.isDemo, network.displayName)
        )
      }
    })

    // Add a specific promise for the Tenderly demo network
    // This ensures it's included, as it was in the original tokenBalanceFunctions array.
    // The getTokenBalances function handles the isDemo flag correctly.
    tokenDataPromises.push(
      getTokenBalancesWithErrorHandling(walletAddress, TENDERLY_DEMO_CONFIG.chainId, true, TENDERLY_DEMO_CONFIG.displayName)
    )

    const allTokenDataResults = await Promise.all(tokenDataPromises)

    // Flatten the results and track network errors
    let tokenData: TokenData[] = []
    const networkErrors: { network: string, error: string }[] = []

    allTokenDataResults.forEach(result => {
      if (result.error) {
        networkErrors.push({ network: result.network, error: result.error })
      } else {
        tokenData.push(...result.tokens)
      }
    })

    // Get Pendle markets data
    const pendleMarkets = await getPendleMarkets('all', chainId)

    // Add Pendle market names to tokens that are Pendle markets
    tokenData = tokenData.map(token => {
      // Check if token is a Pendle market token (PT, YT, or SY)
      const market = pendleMarkets.find(
        m =>
          m.address.toLowerCase() === token.address.toLowerCase()
      )

      if (market) {
        // Add market name to token name
        return {
          ...token,
          name: `${token.name} (${market.name})`
        }
      }
      return token
    })

    // filter out decimal = 0
    tokenData = tokenData.filter(token => token.decimals !== 0)

    // Create the final result object
    return {
      tokens: tokenData,
      networkErrors: networkErrors.length > 0 ? networkErrors : undefined
    }
  } catch (error) {
    console.error('Error fetching wallet balances:', error)
    throw error
  }
}

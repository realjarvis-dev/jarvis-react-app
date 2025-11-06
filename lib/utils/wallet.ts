import { getTokenBalances } from '../alchemy/get-token-balance'
import { getTokenBalances as getTokenBalancesSolana } from '../helius/get-token-balance'
import { getLocalForkTokenBalances, isLocalForkEnvironment } from '../local-fork/token-balance'
import { allNetworkConfigs, TENDERLY_DEMO_CONFIG } from '../network/config'
import { NetworkConfig } from '../network/types'
import { getPendleMarkets } from '../pendle/api'
import { getUserEvmWalletAddress, getUserSolWalletAddress } from '../privy/client'
import { TokenData } from '../types/wallet-token'

// Error handling wrapper for EVM token balances
async function getTokenBalancesWithErrorHandling(
  walletAddress: string,
  chainId: number,
  isDemo: boolean,
  networkName: string,
  bypassCache: boolean = false
): Promise<{ tokens: TokenData[], network: string, error?: string }> {
  try {
    const tokens = await getTokenBalances(walletAddress, chainId, isDemo, bypassCache)
    return { tokens, network: networkName }
  } catch (error) {
    console.error(`Error fetching balances for ${networkName}:`, error)
    
    // Provide more user-friendly error messages for common issues
    let userFriendlyError = error instanceof Error ? error.message : String(error)
    
    if (userFriendlyError.includes('EAPIs not enabled')) {
      userFriendlyError = 'Enhanced APIs not enabled for this network on current plan'
    } else if (userFriendlyError.includes('not enabled for this app')) {
      userFriendlyError = 'Network not enabled in API configuration'
    } else if (userFriendlyError.includes('HTTP error! status: 401')) {
      userFriendlyError = 'API authentication failed'
    } else if (userFriendlyError.includes('HTTP error! status: 403')) {
      userFriendlyError = 'API access forbidden - check network permissions'
    }
    
    return {
      tokens: [],
      network: networkName,
      error: userFriendlyError
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
  chainId: number = 1, // used for pendle markets
  bypassCache: boolean = false // bypass cache for immediate refresh
): Promise<WalletBalanceResult> {
  // Use provided wallet address or environment variable
  const walletAddress = walletAddressParam || (await getUserEvmWalletAddress())
  const solanaWalletAddress = solanaWalletAddressParam || (await getUserSolWalletAddress())
  if (!walletAddress && !solanaWalletAddress) {
    throw new Error('No wallets found. Please sign in to view balances.')
  }

  try {
    const tokenDataPromises: Promise<{ tokens: TokenData[], network: string, error?: string }>[] = []

    // Add promises for all networks in allNetworkConfigs with error handling
    Object.values(allNetworkConfigs).forEach((network: NetworkConfig) => {
      if (network.id === "solana") {
        if (solanaWalletAddress) {
          tokenDataPromises.push(
            getTokenBalancesSolanaWithErrorHandling(solanaWalletAddress, network.displayName)
          )
        }
      } else {
        if (walletAddress) {
          tokenDataPromises.push(
            getTokenBalancesWithErrorHandling(walletAddress, network.chainId, network.isDemo, network.displayName, bypassCache)
          )
        }
      }
    })

    // Add a specific promise for the Sepolia demo network (formerly Tenderly alias)
    // Only include if we have an EVM wallet address
    if (walletAddress) {
      tokenDataPromises.push(
        getTokenBalancesWithErrorHandling(
          walletAddress,
          TENDERLY_DEMO_CONFIG.chainId,
          true,
          TENDERLY_DEMO_CONFIG.displayName,
          bypassCache
        )
      )
    }

    // Add local fork token balances if in local fork environment
    if (isLocalForkEnvironment() && walletAddress) {
      tokenDataPromises.push(
        (async () => {
          try {
            const localForkTokens = await getLocalForkTokenBalances(walletAddress, chainId)
            return { tokens: localForkTokens, network: 'Local Fork' }
          } catch (error) {
            console.warn('Failed to fetch local fork tokens:', error)
            return {
              tokens: [],
              network: 'Local Fork',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })()
      )
    }

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

/**
 * Refresh balances for specific tokens immediately (bypass cache)
 * @param tokenAddresses Array of token addresses to refresh
 * @param userAddress User's wallet address
 * @param chainId Chain ID where the tokens are located
 * @param isDemo Whether this is a demo environment
 */
export async function refreshSpecificTokens(
  tokenAddresses: string[],
  userAddress: string,
  chainId: number,
  isDemo: boolean = false
): Promise<void> {
  try {
    console.log(`Refreshing balances for ${tokenAddresses.length} tokens on chain ${chainId}`)
    
    // Force a fresh balance fetch with cache bypass
    await getWalletBalances(userAddress, undefined, chainId, true)
    
    console.log('Token balances refreshed successfully')
  } catch (error) {
    console.error('Failed to refresh specific token balances:', error)
    // Don't throw - this is a best-effort enhancement
  }
}

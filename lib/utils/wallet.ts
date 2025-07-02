import { ethers } from 'ethers'
import { getTokenBalances } from '../alchemy/get-token-balance'
import { TokenData } from '../types/wallet-token'
import { getTokenBalances as getTokenBalancesSolana } from '../helius/get-token-balance'
import { allNetworkConfigs, TENDERLY_DEMO_CONFIG } from '../network/config'
import { NetworkConfig } from '../network/types'
import { getPendleMarkets } from '../pendle/api'
import { getUserEvmWalletAddress, getUserSolWalletAddress } from '../privy/client'

export interface WalletBalanceResult {
  tokens: TokenData[]
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
    const tokenDataPromises: Promise<TokenData[]>[] = []

    // Add promises for all networks in allNetworkConfigs
    Object.values(allNetworkConfigs).forEach((network: NetworkConfig) => {
      if (network.id === "solana") {
        tokenDataPromises.push(
          getTokenBalancesSolana(solanaWalletAddress)
        )
      } else {
        tokenDataPromises.push(
          getTokenBalances(walletAddress, network.chainId, network.isDemo)
        )
      }
    })

    // Add a specific promise for the Tenderly demo network
    // This ensures it's included, as it was in the original tokenBalanceFunctions array.
    // The getTokenBalances function handles the isDemo flag correctly.
    tokenDataPromises.push(
      getTokenBalances(walletAddress, TENDERLY_DEMO_CONFIG.chainId, true)
    )

    const allTokenDataArrays = await Promise.all(tokenDataPromises)

    // Flatten the results as each call to getTokenBalances returns TokenData[]
    let tokenData = allTokenDataArrays.flat()

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
      tokens: tokenData
    }
  } catch (error) {
    console.error('Error fetching wallet balances:', error)
    throw error
  }
}

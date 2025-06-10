import { TokenBalance } from 'alchemy-sdk'
import { ethers } from 'ethers'
import { getConfigByChainId, TENDERLY_DEMO_CONFIG } from '../network/config'
import { getAlchemyClient } from './client'
import { TokenData } from './types'
import {
  commonlyUsedPTTokensArray,
  commonlyUsedTokensArray,
  getDemoTokenData
} from './utils'

/**
 * Fetches both ERC20 and native token balances for a given wallet address and chain.
 * Uses centralized network configuration and handles demo mode for Tenderly.
 * @param walletAddress The wallet address.
 * @param chainId The target chain ID.
 * @param isDemo Whether to use demo configuration (primarily for Tenderly).
 * @returns A promise that resolves to an array of TokenData.
 */
export async function getTokenBalances(
  walletAddress: string,
  chainId: number,
  isDemo: boolean = false
): Promise<TokenData[]> {
  try {
    const networkConfig = getConfigByChainId(chainId, isDemo)
    if (!networkConfig) {
      console.error(
        `No network configuration found for chainId: ${chainId}, isDemo: ${isDemo}`
      )
      return []
    }

    // Path 1: Tenderly Demo Network (Custom RPC logic)
    if (
      networkConfig.isDemo &&
      networkConfig.id === TENDERLY_DEMO_CONFIG.id &&
      networkConfig.rpcUrl === TENDERLY_DEMO_CONFIG.rpcUrl
    ) {
      console.log("TENDERLY_DEMO_CONFIG.rpcUrl", TENDERLY_DEMO_CONFIG.rpcUrl)
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl)
      const allTokenAddresses = [
        ...commonlyUsedPTTokensArray,
        ...commonlyUsedTokensArray
      ]

      const tokenDataPromises = allTokenAddresses.map(tokenAddress =>
        getDemoTokenData(tokenAddress, walletAddress, provider)
      )

      const resolvedTokenData = await Promise.all(tokenDataPromises)

      const allTokenData: TokenData[] = resolvedTokenData
        .filter(
          (tokenData): tokenData is NonNullable<typeof tokenData> =>
            (tokenData !== null) && (tokenData.decimals !== 0) && (tokenData.symbol !== '') && (tokenData.name !== '')
        )
        .map(tokenData => ({
          ...tokenData,
          network: networkConfig.displayName
        }))

      const nativeBalance = await provider.getBalance(walletAddress)
      const nativeDetails = networkConfig.nativeAsset
      allTokenData.push({
        address: ethers.ZeroAddress,
        name: nativeDetails.name,
        symbol: nativeDetails.symbol,
        balance: ethers.formatUnits(nativeBalance, nativeDetails.decimals),
        decimals: Number(nativeDetails.decimals),
        network: networkConfig.displayName
      })
      return allTokenData
    }

    // Path 2: Standard Alchemy Network (or networks with an Alchemy client)
    const alchemy = getAlchemyClient(chainId, false) // isDemo is false here

    if (!alchemy) {
      // Fallback to RPC for native balance if Alchemy client is not found but RPC URL exists
      if (networkConfig.rpcUrl) {
        console.warn(
          `Alchemy client not found for chainId ${chainId}. Attempting to fetch native balance via RPC.`
        )
        try {
          const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl)
          const nativeBalance = await provider.getBalance(walletAddress)
          const nativeDetails = networkConfig.nativeAsset
          return [
            {
              address: ethers.ZeroAddress,
              name: nativeDetails.name,
              symbol: nativeDetails.symbol,
              balance: ethers.formatUnits(
                nativeBalance,
                nativeDetails.decimals
              ),
              network: networkConfig.displayName,
              decimals: Number(nativeDetails.decimals)
            }
          ]
        } catch (rpcError) {
          console.error(
            `Failed to fetch native balance via RPC for ${chainId} after Alchemy client missing:`,
            rpcError
          )
          return [] // Return empty if RPC fallback also fails
        }
      }
      console.error(
        `Alchemy client not available for chainId: ${chainId}, and no RPC fallback possible.`
      )
      return []
    }

    // Proceed with Alchemy client for ERC20 and native balances
    let erc20Tokens: TokenData[] = []
    try {
      const { tokenBalances } = await alchemy.core.getTokenBalances(
        walletAddress
      )
      const nonZeroBalances = tokenBalances.filter(
        (tb: TokenBalance) => BigInt(tb.tokenBalance || '0x0') !== BigInt(0)
      )

      const metadataPromises = nonZeroBalances.map(tb =>
        alchemy.core.getTokenMetadata(tb.contractAddress)
      )
      const metadatas = await Promise.all(metadataPromises)

      erc20Tokens = nonZeroBalances.map((tb, i) => {
        const meta = metadatas[i]
        const rawBig = BigInt(tb.tokenBalance || '0x0')
        return {
          address: tb.contractAddress,
          name: meta.name ?? 'Unknown',
          symbol: meta.symbol ?? 'UNK',
          balance: ethers.formatUnits(rawBig, meta.decimals ?? 18),
          network: networkConfig.displayName,
          decimals: meta.decimals ?? 18
        }
      })
    } catch (err) {
      console.error(
        `Error fetching ERC20 balances via Alchemy for chainId ${chainId}:`,
        err
      )
      // Continue to fetch native balance even if ERC20 fails
    }

    const nativeWei = await alchemy.core.getBalance(walletAddress, 'latest')
    const nativeDetails = networkConfig.nativeAsset
    const nativeTokenData: TokenData = {
      address: ethers.ZeroAddress,
      name: nativeDetails.name,
      symbol: nativeDetails.symbol,
      balance: ethers.formatUnits(nativeWei.toString(), nativeDetails.decimals),
      network: networkConfig.displayName,
      decimals: Number(nativeDetails.decimals)
    }
    console.log("erc20 before filtering", erc20Tokens)
    erc20Tokens = erc20Tokens.filter(token => {return (token.decimals !== 0) && (token.symbol !== '') && (token.name !== '')})
    console.log("erc20 after filtering", erc20Tokens)
    return [nativeTokenData, ...erc20Tokens]
  } catch (error) {
    console.error(`Error in getTokenBalances for chainId ${chainId}:`, error)
    return []
  }
}

/**
 * Get the native balance of a wallet on a given chain, in wei (as a bigint).
 * @param walletAddress - The address of the wallet.
 * @param chainId - The chain id.
 * @param isDemo - Whether to use demo configuration.
 * @returns The native balance of the wallet on the given chain as a bigint.
 */
export async function getNativeBalanceByChainId(
  walletAddress: string,
  chainId: number,
  isDemo: boolean = false
): Promise<bigint> {
  try {
    const networkConfig = getConfigByChainId(chainId, isDemo)
    if (!networkConfig) {
      console.error(
        `No network configuration found for chainId: ${chainId}, isDemo: ${isDemo}`
      )
      throw new Error(
        `Network configuration not found for chainId: ${chainId}.`
      )
    }

    // Path 1: Tenderly Demo Network (or any network primarily using rpcUrl for demo)
    if (
      networkConfig.isDemo &&
      networkConfig.id === TENDERLY_DEMO_CONFIG.id &&
      networkConfig.rpcUrl === TENDERLY_DEMO_CONFIG.rpcUrl
    ) {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl)
      const balance = await provider.getBalance(walletAddress)
      return BigInt(balance.toString())
    }

    // Path 2: Standard Alchemy Network (or network with an Alchemy client)
    const alchemy = getAlchemyClient(chainId, false) // isDemo is false here
    if (alchemy) {
      const nativeWei = await alchemy.core.getBalance(walletAddress, 'latest')
      return nativeWei.toBigInt()
    }

    // Path 3: Fallback to RPC if Alchemy client is not available but rpcUrl is
    if (networkConfig.rpcUrl) {
      console.warn(
        `Alchemy client not found for chainId ${chainId}. Falling back to RPC for native balance.`
      )
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl)
      const balance = await provider.getBalance(walletAddress)
      return BigInt(balance.toString())
    }

    console.error(
      `Could not determine method to fetch native balance for chainId: ${chainId}. No Alchemy client and no RPC URL.`
    )
    throw new Error(`Cannot fetch native balance for chainId: ${chainId}.`)
  } catch (error) {
    console.error(
      `Error in getNativeBalanceByChainId for chainId ${chainId}:`,
      error
    )
    if (error instanceof Error) {
      throw error
    }
    throw new Error(String(error))
  }
}

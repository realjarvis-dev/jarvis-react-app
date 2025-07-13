import { TokenBalance } from 'alchemy-sdk'
import { ethers } from 'ethers'
import { getConfigByChainId, TENDERLY_DEMO_CONFIG } from '../network/config'
import { TokenData } from '../types/wallet-token'
import { getAlchemyClient } from './client'
import {
  commonlyUsedPTTokensArray,
  commonlyUsedTokensArray,
  getDemoTokenData
} from './utils'
import { getGoldRushWalletBalances, isGoldRushSupported } from '../goldrush/get-token-balance'

// Networks where Alchemy doesn't support Enhanced APIs (ERC-20 token balances)
// Skip Alchemy and go directly to fallback APIs for these networks
const ALCHEMY_UNSUPPORTED_ENHANCED_APIS = [
  5000,   // Mantle - EAPIs not enabled
  // Add other chainIds here as we discover them
]

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

    // Path 0: Skip Alchemy for networks we know don't support Enhanced APIs
    if (ALCHEMY_UNSUPPORTED_ENHANCED_APIS.includes(chainId)) {
      console.info(`Skipping Alchemy for chainId ${chainId} (known to not support Enhanced APIs) - using GoldRush directly`)
      
      if (isGoldRushSupported(chainId)) {
        try {
          const goldRushBalances = await getGoldRushWalletBalances(
            walletAddress,
            chainId,
            networkConfig.displayName
          )
          
          if (goldRushBalances.length > 0) {
            console.info(`Successfully fetched ${goldRushBalances.length} token balances via GoldRush for ${networkConfig.displayName}`)
            return goldRushBalances
          }
        } catch (goldRushError) {
          console.warn(`GoldRush failed for chainId ${chainId}:`, goldRushError)
        }
      }
      
      // Fallback to RPC for native balance only if GoldRush fails
      if (networkConfig.rpcUrl) {
        console.warn(`GoldRush failed, falling back to RPC for native balance only for chainId ${chainId}`)
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
          console.error(`RPC fallback also failed for chainId ${chainId}:`, rpcError)
          return []
        }
      }
      
      console.error(`All methods failed for unsupported chainId ${chainId}`)
      return []
    }

    // Path 1: Tenderly Demo Network (Custom RPC logic)
    if (
      networkConfig.isDemo &&
      networkConfig.id === TENDERLY_DEMO_CONFIG.id &&
      networkConfig.rpcUrl === TENDERLY_DEMO_CONFIG.rpcUrl
    ) {
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
          (tokenData: TokenData | null): tokenData is TokenData =>
            tokenData !== null &&
            tokenData.decimals !== 0 &&
            tokenData.symbol !== '' &&
            tokenData.name !== ''
        )
        .map((tokenData: TokenData) => ({
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
    let alchemy: any
    try {
      alchemy = getAlchemyClient(chainId, false) // isDemo is false here
    } catch (clientError) {
      console.warn(`Alchemy client creation failed for chainId ${chainId}:`, clientError)
      alchemy = null
    }

    if (!alchemy) {
      // For networks like Mantle where Alchemy doesn't support token APIs,
      // try GoldRush as a fallback for complete token balance support
      console.warn(
        `Alchemy client not found for chainId ${chainId}. Attempting GoldRush fallback.`
      )
      
      if (isGoldRushSupported(chainId)) {
        try {
          const goldRushBalances = await getGoldRushWalletBalances(
            walletAddress,
            chainId,
            networkConfig.displayName
          )
          
          if (goldRushBalances.length > 0) {
            console.info(`Successfully fetched ${goldRushBalances.length} token balances via GoldRush for ${networkConfig.displayName}`)
            return goldRushBalances
          }
        } catch (goldRushError) {
          console.warn(`GoldRush fallback failed for chainId ${chainId}:`, goldRushError)
        }
      } else {
        console.warn(`ChainId ${chainId} not supported by GoldRush API`)
      }
      
      // Final fallback to RPC for native balance only
      if (networkConfig.rpcUrl) {
        console.warn(
          `Falling back to RPC for native balance only for chainId ${chainId}.`
        )
        try {
          const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl)
          const nativeBalance = await provider.getBalance(walletAddress)
          const nativeDetails = networkConfig.nativeAsset
          
          console.info(`Note: Only native balance available for ${networkConfig.displayName} - ERC-20 tokens not supported`)
          
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
            `Failed to fetch native balance via RPC for ${chainId}:`,
            rpcError
          )
          return [] // Return empty if all fallbacks fail
        }
      }
      console.error(
        `All token balance methods failed for chainId: ${chainId}.`
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
      
      // Check if this is a known API configuration issue
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('EAPIs not enabled')) {
        console.warn(`Enhanced APIs not enabled for chainId ${chainId} on current Alchemy plan - trying GoldRush fallback for ERC-20 tokens`)
        console.info(`Note: Consider adding chainId ${chainId} to ALCHEMY_UNSUPPORTED_ENHANCED_APIS to skip this API call in the future`)
        
        // Try GoldRush fallback for ERC-20 tokens when Alchemy Enhanced APIs fail
        if (isGoldRushSupported(chainId)) {
          try {
            const goldRushBalances = await getGoldRushWalletBalances(
              walletAddress,
              chainId,
              networkConfig.displayName
            )
            
            // Filter out native token since we'll get it from Alchemy
            erc20Tokens = goldRushBalances.filter(token => 
              token.address !== ethers.ZeroAddress && 
              token.address !== '0x0000000000000000000000000000000000000000'
            )
            
            if (erc20Tokens.length > 0) {
              console.info(`Successfully fetched ${erc20Tokens.length} ERC-20 tokens via GoldRush fallback`)
            }
          } catch (goldRushError) {
            console.warn(`GoldRush ERC-20 fallback failed for chainId ${chainId}:`, goldRushError)
          }
        } else {
          console.warn(`GoldRush fallback not available for chainId ${chainId}`)
        }
      }
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
    erc20Tokens = erc20Tokens.filter(token => {
      return token.decimals !== 0 && token.symbol !== '' && token.name !== ''
    })
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

import { Network } from 'alchemy-sdk'
import type { ChainType, NetworkConfig } from './types'

// Individual network configurations
// These objects must match the NetworkConfig interface from types.ts
// The `id` field is crucial as it forms the basis for ChainType

export const ethereumConfig: NetworkConfig = {
  id: 'ethereum' as const,
  displayName: 'Ethereum',
  chainId: 1,
  rpcUrl:
    'https://eth-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr',
  scanLink: 'etherscan.io',
  isDemo: false,
  alchemyNetwork: Network.ETH_MAINNET,
  icon: '/icons/chains/ethereum-eth.svg'
}

export const berachainConfig: NetworkConfig = {
  id: 'berachain' as const,
  displayName: 'Berachain',
  alchemyNetwork: Network.BERACHAIN_MAINNET, 
  chainId: 80094,
  rpcUrl:
    'https://berachain-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr',
  scanLink: 'berascan.com',
  isDemo: false,
  icon: '/icons/chains/berachain.svg'
}

export const baseConfig: NetworkConfig = {
  id: 'base' as const,
  displayName: 'Base',
  chainId: 8453,
  rpcUrl:
    'https://base-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr',
  scanLink: 'basescan.org',
  isDemo: false,
  alchemyNetwork: Network.BASE_MAINNET
  // icon: '/icons/chains/base.svg', // Add icon if available
}

export const arbitrumConfig: NetworkConfig = {
  id: 'arbitrum' as const,
  displayName: 'Arbitrum',
  chainId: 42161,
  rpcUrl:
    'https://arb-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr',
  scanLink: 'arbiscan.io',
  isDemo: false,
  alchemyNetwork: Network.ARB_MAINNET
  // icon: '/icons/chains/arbitrum.svg', // Add icon if available
}

export const polygonConfig: NetworkConfig = {
  id: 'polygon' as const,
  displayName: 'Polygon',
  chainId: 137,
  rpcUrl:
    'https://polygon-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr',
  scanLink: 'polygonscan.com',
  isDemo: false,
  alchemyNetwork: Network.MATIC_MAINNET
  // icon: '/icons/chains/polygon.svg', // Add icon if available
}

export const optimismConfig: NetworkConfig = {
  id: 'optimism' as const,
  displayName: 'Optimism',
  chainId: 10,
  rpcUrl:
    'https://opt-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr',
  scanLink: 'optimistic.etherscan.io',
  isDemo: false,
  alchemyNetwork: Network.OPT_MAINNET
  // icon: '/icons/chains/optimism.svg', // Add icon if available
}

/**
 * A mapping of all available production/main network configurations.
 * The keys of this object are used to generate the `ChainType`.
 * Using `as const` ensures that the keys are treated as literal types.
 */
export const allNetworkConfigs = {
  ethereum: ethereumConfig,
  berachain: berachainConfig,
  base: baseConfig,
  arbitrum: arbitrumConfig,
  polygon: polygonConfig,
  optimism: optimismConfig
} as const

/**
 * Configuration for the Tenderly demo environment.
 * This is a special configuration used when `isDemoMode` is true.
 * It currently mimics Ethereum Mainnet but uses Tenderly's RPC.
 */
export const TENDERLY_DEMO_CONFIG: NetworkConfig = {
  id: 'ethereum' as const, // In demo mode, selectedChain is forced to 'ethereum'
  displayName: 'Ethereum (Demo)',
  chainId: 1, // Match Ethereum Mainnet for consistency in demo, was TenderlyDemoConfig.chainId
  rpcUrl:
    process.env.NEXT_PUBLIC_TEST_NET_ENV === 'development'
      ? 'https://virtual.mainnet.rpc.tenderly.co/ce583582-c194-4405-bfc5-6ee33e99fa8b'
      : 'http://anvil-fork:8545',
  scanLink: undefined, // Tenderly vnet explorer might not have a simple base URL like etherscan
  isDemo: true,
  alchemyNetwork: Network.ETH_MAINNET,
  icon: '/icons/chains/ethereum-eth.svg' // Use Ethereum icon for demo
}

/**
 * Get the active network configuration based on demo mode and selected chain.
 * @param isDemoMode - Whether demo mode is enabled.
 * @param selectedChain - The currently selected chain identifier.
 * @returns The active `NetworkConfig`.
 */
export function getActiveNetworkConfig(
  isDemoMode: boolean,
  selectedChain: ChainType
): NetworkConfig {
  if (isDemoMode) {
    // In demo mode, the UI forces selectedChain to 'ethereum'.
    // So, we return the TENDERLY_DEMO_CONFIG which is set up for Ethereum demo.
    return TENDERLY_DEMO_CONFIG
  }
  // In normal mode, return the configuration for the selected chain.
  // The type assertion `selectedChain as any` might be needed if TS struggles with `allNetworkConfigs[selectedChain]`
  // but direct indexing should work due to ChainType being `keyof typeof allNetworkConfigs`.
  return allNetworkConfigs[selectedChain]
}

/**
 * Get a list of available chain identifiers based on the demo mode.
 * @param isDemoMode - Whether demo mode is enabled.
 * @returns An array of `ChainType` identifiers.
 */
export function getAvailableChains(isDemoMode: boolean): ChainType[] {
  if (isDemoMode) {
    // In demo mode, only Ethereum (which maps to TENDERLY_DEMO_CONFIG) is available.
    return ['ethereum']
  }
  // In normal mode, all chains defined in `allNetworkConfigs` are available.
  return Object.keys(allNetworkConfigs) as ChainType[]
}

/**
 * Get a network configuration by its chain ID.
 * This function searches through `allNetworkConfigs`.
 * Note: This does not explicitly return demo configurations unless their chainId is unique and searched.
 * `getActiveNetworkConfig` is the preferred way to get demo-aware configs.
 * @param chainId - The chain ID to search for.
 * @returns The `NetworkConfig` if found, otherwise `undefined`.
 */
export function getConfigByChainId(chainId: number, isDemo: boolean): NetworkConfig {
  if (isDemo) {
    return TENDERLY_DEMO_CONFIG
  }
  for (const key in allNetworkConfigs) {
    const network = allNetworkConfigs[key as ChainType]
    if (network.chainId === chainId) {
      return network
    }
  }
  // Optionally, check TENDERLY_DEMO_CONFIG if its chainId might be queried directly
  // However, be mindful of chainId clashes (e.g., demo using chainId 1)
  // if (TENDERLY_DEMO_CONFIG.chainId === chainId) {
  //   return TENDERLY_DEMO_CONFIG;
  // }
  throw new Error(`No network config found for chainId: ${chainId}`)
}

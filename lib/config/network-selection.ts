import { ChainType } from '@/components/chain-selector'
import {
  BerachainMainnetConfig,
  MainnetConfig,
  TenderlyDemoConfig
} from './network'

export interface NetworkConfig {
  chainId: number
  name: string
  rpcUrl: string
  scanLink?: string
  isDemo: boolean
}

// Network configurations using existing configs
export const NETWORK_CONFIGS: Record<ChainType, NetworkConfig> = {
  ethereum: {
    chainId: MainnetConfig.chainId,
    name: 'Ethereum Mainnet',
    rpcUrl: MainnetConfig.rpcUrl,
    scanLink: MainnetConfig.scanLink,
    isDemo: false
  },
  berachain: {
    chainId: BerachainMainnetConfig.chainId,
    name: 'Berachain Mainnet',
    rpcUrl: BerachainMainnetConfig.rpcUrl,
    scanLink: BerachainMainnetConfig.scanLink,
    isDemo: false
  }
}

// Demo network configuration (Tenderly vnet)
export const DEMO_NETWORK_CONFIG: NetworkConfig = {
  chainId: TenderlyDemoConfig.chainId,
  name: 'Ethereum (Demo)',
  rpcUrl: TenderlyDemoConfig.rpcUrl,
  scanLink: TenderlyDemoConfig.scanLink,
  isDemo: true
}

/**
 * Get the active network configuration based on demo mode and selected chain
 */
export function getActiveNetworkConfig(isDemoMode: boolean, selectedChain: ChainType): NetworkConfig {
  if (isDemoMode) {
    // In demo mode, always use Tenderly vnet regardless of selected chain
    return DEMO_NETWORK_CONFIG
  }
  
  // In normal mode, use the selected chain's configuration
  return NETWORK_CONFIGS[selectedChain]
}

/**
 * Get available chains based on demo mode
 */
export function getAvailableChains(isDemoMode: boolean): ChainType[] {
  if (isDemoMode) {
    // In demo mode, only Ethereum is available
    return ['ethereum']
  }
  
  // In normal mode, all chains are available
  return ['ethereum', 'berachain']
} 
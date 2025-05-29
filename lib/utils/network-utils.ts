import { useNetwork } from '../context/network-context'
import { NetworkContext } from './tool-registry'

/**
 * Convert network context from React context to tool registry format
 */
export function createNetworkContext(
  selectedChain: 'ethereum' | 'sepolia' | 'berachain',
  isDemoMode: boolean,
  activeNetwork: any
): NetworkContext {
  const selectedNetwork = isDemoMode ? 'demo' : selectedChain
  
  return {
    selectedNetwork,
    selectedChainId: activeNetwork.chainId,
    isDemo: isDemoMode,
    rpcUrl: activeNetwork.rpcUrl,
    config: activeNetwork
  }
}

/**
 * Hook to get network context in tool registry format
 */
export function useNetworkContext(): NetworkContext {
  const { selectedChain, isDemoMode, activeNetwork } = useNetwork()
  return createNetworkContext(selectedChain, isDemoMode, activeNetwork)
} 
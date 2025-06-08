import { useNetwork } from '@/components/lightweight-network-provider'
import { ChainType } from '@/lib/network/types'
import { NetworkContext } from '@/lib/types/context'

/**
 * Convert network context from React context to tool registry format
 */
export function createNetworkContext(
  selectedChain: ChainType | 'demo',
  isDemoMode: boolean,
  activeNetwork: any
): NetworkContext {
  let selectedNetwork = selectedChain
  if (isDemoMode) {
    selectedNetwork = 'demo'
  }
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
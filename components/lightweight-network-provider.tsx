'use client'

import { createContext, ReactNode, useContext, useState } from 'react'
import { ChainType, NetworkConfig } from '@/lib/network/types'
import { getActiveNetworkConfig } from '@/lib/network/config'

interface NetworkContextType {
  selectedChain: ChainType
  isDemoMode: boolean
  activeNetwork: NetworkConfig
  setSelectedChain: (chain: ChainType) => void
  setIsDemoMode: (enabled: boolean) => void
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

interface LightweightNetworkProviderProps {
  children: ReactNode
}

export function LightweightNetworkProvider({ children }: LightweightNetworkProviderProps) {
  // Use static defaults to avoid any cookie operations during LCP
  const [selectedChain] = useState<ChainType>('ethereum')
  const [isDemoMode] = useState(true)
  
  // Use memoized config to avoid recalculation
  const activeNetwork = getActiveNetworkConfig(selectedChain, isDemoMode)
  
  // Placeholder functions for LCP testing
  const setSelectedChain = () => {}
  const setIsDemoMode = () => {}

  const contextValue: NetworkContextType = {
    selectedChain,
    isDemoMode,
    activeNetwork,
    setSelectedChain,
    setIsDemoMode
  }

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}
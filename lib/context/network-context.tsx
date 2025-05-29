'use client'

import { ChainType } from '@/components/chain-selector'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { getActiveNetworkConfig, NetworkConfig } from '../config/network-selection'

interface NetworkContextType {
  selectedChain: ChainType
  isDemoMode: boolean
  activeNetwork: NetworkConfig
  setSelectedChain: (chain: ChainType) => void
  setIsDemoMode: (enabled: boolean) => void
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

interface NetworkProviderProps {
  children: ReactNode
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [selectedChain, setSelectedChain] = useState<ChainType>('ethereum')
  const [isDemoMode, setIsDemoMode] = useState(false)

  // Calculate active network based on current state
  const activeNetwork = getActiveNetworkConfig(isDemoMode, selectedChain)

  // When demo mode is enabled, force chain selection to ethereum
  useEffect(() => {
    if (isDemoMode && selectedChain !== 'ethereum') {
      setSelectedChain('ethereum')
    }
  }, [isDemoMode, selectedChain])

  const value: NetworkContextType = {
    selectedChain,
    isDemoMode,
    activeNetwork,
    setSelectedChain,
    setIsDemoMode
  }

  return (
    <NetworkContext.Provider value={value}>
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
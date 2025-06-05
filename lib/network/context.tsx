'use client'

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from 'react'
import { getActiveNetworkConfig } from './config' // Updated import path
import { ChainType, NetworkConfig } from './types' // Updated import path

const USER_SELECTED_NETWORK_COOKIE_KEY = 'user_selected_network'

// Helper function to set a cookie (simplified)
const setCookie = (name: string, value: string, days: number = 7) => {
  if (typeof document === 'undefined') return // Guard for SSR or non-browser environments
  let expires = ''
  if (days) {
    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
    expires = '; expires=' + date.toUTCString()
  }
  document.cookie = name + '=' + (value || '') + expires + '; path=/'
}

// Helper function to get a cookie (simplified)
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null // Guard for SSR or non-browser environments
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

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
  const [isDemoMode, setIsDemoMode] = useState(true) // Default to true

  // Initialize selectedChain from cookie or default to 'ethereum'
  const [selectedChain, setSelectedChainInternal] = useState<ChainType>(() => {
    const cookieValue = getCookie(
      USER_SELECTED_NETWORK_COOKIE_KEY
    ) as ChainType | null
    // Basic validation if the cookieValue is a valid ChainType can be added here by checking against Object.keys(allNetworkConfigs)
    // For now, we trust it or default. If cookieValue is not a valid ChainType, it will default to 'ethereum'.
    // A more robust check could involve: `Object.keys(allNetworkConfigs).includes(cookieValue) ? cookieValue : 'ethereum'`
    return cookieValue || 'ethereum'
  })

  // Update cookie when selectedChain changes
  useEffect(() => {
    setCookie(USER_SELECTED_NETWORK_COOKIE_KEY, selectedChain)
  }, [selectedChain])

  // When demo mode is enabled, force chain selection to ethereum
  // This also updates the cookie via the selectedChain useEffect
  useEffect(() => {
    if (isDemoMode && selectedChain !== 'ethereum') {
      setSelectedChainInternal('ethereum')
    }
  }, [isDemoMode, selectedChain])

  // Calculate active network based on current state
  const activeNetwork = getActiveNetworkConfig(isDemoMode, selectedChain)

  // Wrapper for setSelectedChain to also update the cookie
  const setSelectedChain = (chain: ChainType) => {
    setSelectedChainInternal(chain)
    // No need to call setCookie here, the useEffect [selectedChain] handles it.
  }

  const value: NetworkContextType = {
    selectedChain,
    isDemoMode,
    activeNetwork,
    setSelectedChain, // Use the wrapped function
    setIsDemoMode
  }

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}

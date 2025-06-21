'use client'

import { getCookie, setCookie } from '@/lib/utils/cookies' // Import from centralized cookie utilities
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from 'react'
import { allNetworkConfigs, getActiveNetworkConfig } from './config' // Updated import path
import { ChainType, NetworkConfig } from './types' // Updated import path
import { USER_SELECTED_NETWORK_COOKIE_KEY, USER_DEMO_MODE_COOKIE_KEY } from './types'
// const USER_SELECTED_NETWORK_COOKIE_KEY = 'user_selected_network'
// const USER_DEMO_MODE_COOKIE_KEY = 'user_demo_mode' // New cookie key for demo mode

// Helper function to set a cookie (simplified)
// const setCookie = (name: string, value: string, days: number = 7) => {
//   if (typeof document === 'undefined') return // Guard for SSR or non-browser environments
//   let expires = ''
//   if (days) {
//     const date = new Date()
//     date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
//     expires = '; expires=' + date.toUTCString()
//   }
//   document.cookie = name + '=' + (value || '') + expires + '; path=/'
// }

// Helper function to get a cookie (simplified)
// const getCookie = (name: string): string | null => {
//   if (typeof document === 'undefined') return null // Guard for SSR or non-browser environments
//   const nameEQ = name + '='
//   const ca = document.cookie.split(';')
//   for (let i = 0; i < ca.length; i++) {
//     let c = ca[i]
//     while (c.charAt(0) === ' ') c = c.substring(1, c.length)
//     if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
//   }
//   return null
// }

interface NetworkContextType {
  selectedChain: ChainType
  isDemoMode: boolean
  allChainTypes: ChainType[]
  activeNetwork: NetworkConfig
  setSelectedChain: (chain: ChainType) => void
  setIsDemoMode: (enabled: boolean) => void
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

interface NetworkProviderProps {
  children: ReactNode
  initialSelectedChain?: ChainType
  initialIsDemoMode?: boolean
}

export function NetworkProvider({ 
  children, 
  initialSelectedChain, 
  initialIsDemoMode 
}: NetworkProviderProps) {
  const [mounted, setMounted] = useState(false)
  const [isDemoMode, setIsDemoModeInternal] = useState(initialIsDemoMode ?? false)
  const [selectedChain, setSelectedChainInternal] = useState<ChainType>(initialSelectedChain ?? 'ethereum')

  const allChainTypes = Object.keys(allNetworkConfigs) as ChainType[]

  useEffect(() => {
    setMounted(true)
  }, []) // Runs once to set mounted to true on the client

  // Effect to initialize states from cookies, AFTER mount - only if no initial values provided
  useEffect(() => {
    if (!mounted) return
    
    if (initialSelectedChain === undefined || initialIsDemoMode === undefined) {
      const networkCookieValue = getCookie(USER_SELECTED_NETWORK_COOKIE_KEY) as ChainType | null
      const demoCookieValue = getCookie(USER_DEMO_MODE_COOKIE_KEY)
      
      if (initialSelectedChain === undefined && networkCookieValue) {
        let chainToSet = networkCookieValue
        // Adjust chainToSet based on demo mode
        if (isDemoMode && chainToSet !== 'ethereum') {
          chainToSet = 'ethereum'
        }
        if (selectedChain !== chainToSet) {
          setSelectedChainInternal(chainToSet)
        }
      }
      
      if (initialIsDemoMode === undefined) {
        let demoModeToSet = true // Default if cookie not set or invalid
        if (demoCookieValue === 'true') {
          demoModeToSet = true
        } else if (demoCookieValue === 'false') {
          demoModeToSet = false
        }
        if (isDemoMode !== demoModeToSet) {
          setIsDemoModeInternal(demoModeToSet)
        }
      }
    }
  }, [mounted, initialSelectedChain, initialIsDemoMode, isDemoMode, selectedChain])

  // Effect to update selectedChain cookie when selectedChain changes, AFTER mount
  useEffect(() => {
    if (!mounted) return
    setCookie(USER_SELECTED_NETWORK_COOKIE_KEY, selectedChain)
  }, [mounted, selectedChain])

  // Effect to update isDemoMode cookie when isDemoMode changes, AFTER mount
  useEffect(() => {
    if (!mounted) return
    setCookie(USER_DEMO_MODE_COOKIE_KEY, isDemoMode.toString())
  }, [mounted, isDemoMode])

  // When isDemoMode is changed by user, adjust selectedChain if necessary
  useEffect(() => {
    if (!mounted) return
    if (isDemoMode && selectedChain !== 'ethereum') {
      setSelectedChainInternal('ethereum')
      // The selectedChain cookie will be updated by its own useEffect
    }
  }, [mounted, isDemoMode, selectedChain]) // Add selectedChain here to re-evaluate if it changes

  // Calculate active network based on current state
  const activeNetwork = getActiveNetworkConfig(isDemoMode, selectedChain)

  const wrappedSetSelectedChain = (chain: ChainType) => {
    setSelectedChainInternal(chain)
  }

  const wrappedSetIsDemoMode = (enabled: boolean) => {
    setIsDemoModeInternal(enabled)
  }

  const value: NetworkContextType = {
    selectedChain,
    isDemoMode,
    activeNetwork,
    allChainTypes,
    setSelectedChain: wrappedSetSelectedChain,
    setIsDemoMode: wrappedSetIsDemoMode
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

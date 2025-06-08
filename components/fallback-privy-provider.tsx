'use client'

import React, { useEffect, useState } from 'react'

// Minimal context that delays Privy loading significantly
const FallbackPrivyContext = React.createContext<{
  isPrivyReady: boolean
}>({
  isPrivyReady: false
})

interface FallbackPrivyProviderProps {
  children: React.ReactNode
}

export function FallbackPrivyProvider({ children }: FallbackPrivyProviderProps) {
  const [isMounted, setIsMounted] = useState(false)
  const contextValue = { isPrivyReady: false }

  useEffect(() => {
    // Delay mounting to avoid any initialization issues
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 2000) // 2 second delay
    
    return () => clearTimeout(timer)
  }, [])

  if (!isMounted) {
    return (
      <FallbackPrivyContext.Provider value={contextValue}>
        {children}
      </FallbackPrivyContext.Provider>
    )
  }

  return (
    <FallbackPrivyContext.Provider value={contextValue}>
      {children}
    </FallbackPrivyContext.Provider>
  )
}

// Hook for components to check if Privy is ready (always false in fallback)
export function usePrivyReady() {
  return React.useContext(FallbackPrivyContext)
}
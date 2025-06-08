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
  const contextValue = { isPrivyReady: false }

  // Remove artificial delay that was blocking LCP for 2+ seconds
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
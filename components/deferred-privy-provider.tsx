'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Create a simple context for managing loading state
const DeferredLoadingContext = React.createContext<{
  isPrivyReady: boolean
}>({
  isPrivyReady: false
})

// Dynamically load PrivyProvider after critical content renders
const PrivyProvider = dynamic(() => import('./privy-provider').then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => null // No loading component to avoid blocking LCP
})

interface DeferredPrivyProviderProps {
  children: React.ReactNode
}

export function DeferredPrivyProvider({ children }: DeferredPrivyProviderProps) {
  const [shouldLoadPrivy, setShouldLoadPrivy] = useState(false)
  const [isPrivyReady, setIsPrivyReady] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return
    
    // Defer Privy loading until after LCP
    const loadPrivy = () => {
      setShouldLoadPrivy(true)
      // Mark Privy as ready after a short delay to ensure it's initialized
      setTimeout(() => setIsPrivyReady(true), 100)
    }

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        // Use requestIdleCallback for better performance
        window.requestIdleCallback(loadPrivy, { timeout: 1000 })
      } else {
        // Fallback to setTimeout
        setTimeout(loadPrivy, 50)
      }
    }
  }, [isMounted])

  // Provide loading context to children
  const contextValue = { isPrivyReady }

  if (!shouldLoadPrivy || !isMounted) {
    // Render children without Privy provider initially for faster LCP
    return (
      <DeferredLoadingContext.Provider value={contextValue}>
        {children}
      </DeferredLoadingContext.Provider>
    )
  }

  // Wrap in error boundary for safety
  try {
    return (
      <DeferredLoadingContext.Provider value={contextValue}>
        <PrivyProvider>{children}</PrivyProvider>
      </DeferredLoadingContext.Provider>
    )
  } catch (error) {
    console.error('Error loading PrivyProvider:', error)
    return (
      <DeferredLoadingContext.Provider value={contextValue}>
        {children}
      </DeferredLoadingContext.Provider>
    )
  }
}

// Hook for components to check if Privy is ready
export function usePrivyReady() {
  return React.useContext(DeferredLoadingContext)
}
'use client'

import { useState, useEffect } from 'react'
import { UltraMinimalChat } from './ultra-minimal-chat'
import dynamic from 'next/dynamic'

// Lazy load the full chat after LCP is achieved
const FullChat = dynamic(() => import('./full-chat').then(mod => ({ default: mod.FullChat })), {
  ssr: false,
  loading: () => null
})

interface PerformanceOptimizedChatProps {
  id: string
  savedMessages?: any[]
  query?: string
}

export function PerformanceOptimizedChat({ id, savedMessages, query }: PerformanceOptimizedChatProps) {
  const [shouldLoadFullChat, setShouldLoadFullChat] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)

  useEffect(() => {
    // Load full chat after LCP using requestIdleCallback or timeout
    const loadFullChat = () => setShouldLoadFullChat(true)
    
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadFullChat, { timeout: 2000 })
      } else {
        setTimeout(loadFullChat, 1000)
      }
    }
  }, [])

  // Also load full chat on user interaction
  const handleUserInteraction = () => {
    if (!userInteracted) {
      setUserInteracted(true)
      setShouldLoadFullChat(true)
    }
  }

  // Show ultra-minimal chat immediately for LCP
  if (!shouldLoadFullChat) {
    return (
      <div onClick={handleUserInteraction} onKeyDown={handleUserInteraction}>
        <UltraMinimalChat id={id} />
      </div>
    )
  }

  // Show full chat after it's loaded
  return <FullChat id={id} savedMessages={savedMessages} query={query} />
}
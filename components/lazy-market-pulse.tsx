'use client'

import React, { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Static placeholder component for immediate LCP rendering
const MarketPulsePlaceholder = () => (
  <div className="flex overflow-x-auto gap-4 py-1 px-2 hide-scrollbar text-xs sm:text-sm text-white/90 bg-gradient-to-r from-[#bfc7ce]/30 via-[#e6e8ea]/40 to-[#bfc7ce]/30 rounded-full shadow-[0_0_24px_4px_rgba(200,200,220,0.45),0_0_4px_1px_rgba(255,255,255,0.18)] backdrop-blur-sm border border-white/20">
    <div className="flex items-center gap-1 whitespace-nowrap px-2 py-1">
      <span className="font-semibold">Market Pulse</span>
    </div>
  </div>
)

// Dynamically load MarketPulse after LCP
const MarketPulse = dynamic(() => import('./market-pulse').then(mod => ({ default: mod.MarketPulse })), {
  ssr: false,
  loading: () => <MarketPulsePlaceholder />
})

export function LazyMarketPulse() {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    // Defer loading significantly to avoid blocking LCP
    const loadMarketPulse = () => {
      setShouldLoad(true)
    }

    if (typeof window !== 'undefined') {
      // Delay much longer to ensure LCP completes first
      setTimeout(loadMarketPulse, 5000) // 5 second delay
    }
  }, [])

  // Show placeholder immediately for LCP, then load actual component
  if (!shouldLoad) {
    return <MarketPulsePlaceholder />
  }

  return (
    <Suspense fallback={<MarketPulsePlaceholder />}>
      <MarketPulse />
    </Suspense>
  )
}

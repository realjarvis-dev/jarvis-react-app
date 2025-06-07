'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'

const MarketPulse = dynamic(() => import('./market-pulse').then(mod => ({ default: mod.MarketPulse })), {
  ssr: false,
  loading: () => (
    <div className="flex overflow-x-auto gap-4 py-1 px-2 hide-scrollbar text-xs sm:text-sm text-white/90 bg-gradient-to-r from-[#bfc7ce]/30 via-[#e6e8ea]/40 to-[#bfc7ce]/30 rounded-full shadow-[0_0_24px_4px_rgba(200,200,220,0.45),0_0_4px_1px_rgba(255,255,255,0.18)] backdrop-blur-sm border border-white/20 animate-pulse">
      <div className="flex items-center gap-1 whitespace-nowrap px-2 py-1">
        <span className="font-semibold">Loading market data...</span>
      </div>
    </div>
  )
})

export function LazyMarketPulse() {
  return (
    <Suspense fallback={
      <div className="flex overflow-x-auto gap-4 py-1 px-2 hide-scrollbar text-xs sm:text-sm text-white/90 bg-gradient-to-r from-[#bfc7ce]/30 via-[#e6e8ea]/40 to-[#bfc7ce]/30 rounded-full shadow-[0_0_24px_4px_rgba(200,200,220,0.45),0_0_4px_1px_rgba(255,255,255,0.18)] backdrop-blur-sm border border-white/20 animate-pulse">
        <div className="flex items-center gap-1 whitespace-nowrap px-2 py-1">
          <span className="font-semibold">Loading market data...</span>
        </div>
      </div>
    }>
      <MarketPulse />
    </Suspense>
  )
}

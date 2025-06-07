'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'

const WelcomeMessage = dynamic(() => import('./welcome-messages').then(mod => ({ default: mod.WelcomeMessage })), {
  ssr: false,
  loading: () => (
    <div className="h-8 w-64 bg-muted animate-pulse rounded text-center text-base sm:text-lg md:text-2xl lg:text-3xl font-semibold w-full max-w-full px-0 sm:px-1 md:px-2 lg:px-4 min-h-[30px] sm:min-h-[40px]" />
  )
})

export function LazyWelcomeMessage(props: any) {
  return (
    <Suspense fallback={
      <div className="h-8 w-64 bg-muted animate-pulse rounded text-center text-base sm:text-lg md:text-2xl lg:text-3xl font-semibold w-full max-w-full px-0 sm:px-1 md:px-2 lg:px-4 min-h-[30px] sm:min-h-[40px]" />
    }>
      <WelcomeMessage {...props} />
    </Suspense>
  )
}

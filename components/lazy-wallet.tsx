'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const WalletComponent = dynamic(() => import('./wallet/index').then(mod => ({ default: mod.LazyWallet })), {
  loading: () => (
    <div className="flex items-center space-x-2">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  ),
  ssr: false
})

export default WalletComponent

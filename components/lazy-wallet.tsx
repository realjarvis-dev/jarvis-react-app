'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const WalletComponent = dynamic(() => import('./wallet/index').then(mod => ({ default: mod.LazyWallet })), {
  loading: () => null, // No loading component to avoid blocking LCP
  ssr: false
})

export default WalletComponent

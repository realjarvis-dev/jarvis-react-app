'use client'

import { useNetwork } from '@/lib/context/network-context'

export function NetworkDebug() {
  const { selectedChain, isDemoMode, activeNetwork } = useNetwork()

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed top-20 right-4 bg-black/80 text-white p-3 rounded-lg text-xs z-50">
      <div className="font-bold mb-2">Network Debug</div>
      <div>Selected Chain: {selectedChain}</div>
      <div>Demo Mode: {isDemoMode ? 'ON' : 'OFF'}</div>
      <div>Active Network: {activeNetwork.name}</div>
      <div>Chain ID: {activeNetwork.chainId}</div>
      <div>Is Demo: {activeNetwork.isDemo ? 'YES' : 'NO'}</div>
    </div>
  )
} 
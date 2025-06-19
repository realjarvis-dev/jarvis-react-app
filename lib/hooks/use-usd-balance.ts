'use client'

import { useNetwork } from '@/lib/network/context'
import { usePrivy } from '@privy-io/react-auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BalanceChangeEvent } from '../pubsub/types'


export function useUsdBalance() {
  const { selectedChain, isDemoMode } = useNetwork()
  const { user, ready, authenticated } = usePrivy()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'usdBalance',
      selectedChain,
      isDemoMode,
      user?.id,
      ready,
      authenticated
    ],
    queryFn: () => {
      if (!ready || !authenticated) {
        return 0
      }
      return fetch('/api/wallet/token-usd-price')
        .then(res => res.json())
        .then(data => {
          return data.usdBalance
        })
    },
    enabled: ready && authenticated,
    staleTime: 600_000,
    gcTime: 600_000
  })

  useEffect(() => {
    if (ready && authenticated) {
      const eventSource = new EventSource('/api/wallet/balance-change-stream')
      console.log('eventSource', eventSource)
      eventSource.onmessage = event => {
        console.log(
          'Received balance update from stream, refetching USD balance.',
          event.data
        )
        const data = JSON.parse(event.data) as BalanceChangeEvent
        for (const affectedChain of data.affectedChains) {
          queryClient.invalidateQueries({ queryKey: ['usdBalance', affectedChain, data.isDemo] })
        }
      }

      eventSource.onerror = error => {
        console.error('EventSource failed:', error)
        // eventSource.close()
      }

      return () => {
        eventSource.close()
      }
    }
  }, [ready, authenticated, queryClient])

  return { data, isLoading, error }
}

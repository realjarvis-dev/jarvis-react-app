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
    queryFn: async () => {
      if (!ready || !authenticated) {
        return 0
      }
      try {
        const res = await fetch('/api/wallet/token-usd-price')
        if (!res.ok) {
          if (res.status === 401) {
            console.log('User not authenticated for USD balance')
            return 0
          }
          if (res.status === 400) {
            console.log('User wallet configuration issue for USD balance')
            return 0
          }
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        const data = await res.json()
        return data.usdBalance ?? 0
      } catch (error) {
        console.error('Error fetching USD balance:', error)
        return 0
      }
    },
    enabled: ready && authenticated,
    staleTime: 600_000,
    gcTime: 600_000
  })

  useEffect(() => {
    if (ready && authenticated) {
      let eventSource: EventSource | null = null
      
      try {
        eventSource = new EventSource('/api/wallet/balance-change-stream')
        console.log('EventSource initialized')

        eventSource.onmessage = event => {
          try {
            console.log(
              'Received balance update from stream, refetching USD balance.',
              event.data
            )
            const data = JSON.parse(event.data) as BalanceChangeEvent
            for (const affectedChain of data.affectedChains) {
              queryClient.invalidateQueries({ queryKey: ['usdBalance', affectedChain, data.isDemo] })
            }
          } catch (parseError) {
            console.warn('Failed to parse balance change event:', parseError)
          }
        }

        eventSource.onerror = error => {
          console.warn('EventSource connection issue:', error)
          // Don't close automatically as the browser will attempt to reconnect
        }

        eventSource.onopen = () => {
          console.log('Balance change stream connected')
        }
      } catch (error) {
        console.error('Failed to initialize EventSource:', error)
      }

      return () => {
        if (eventSource) {
          eventSource.close()
        }
      }
    }
  }, [ready, authenticated, queryClient])

  return { data, isLoading, error }
}

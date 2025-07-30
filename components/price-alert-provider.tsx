'use client'

import { usePrivy } from '@privy-io/react-auth'
import { createContext, ReactNode, useContext, useEffect } from 'react'
import { toast } from 'sonner'
import { pusher, Pusher } from '@/lib/pusher/pusher'
import { useQueryClient } from '@tanstack/react-query'

interface PriceAlertContextType {
  pusher: Pusher | null
}

const PriceAlertContext = createContext<PriceAlertContextType>({ pusher: null })
export const usePriceAlert = () => useContext(PriceAlertContext)

export const PriceAlertProvider = ({ children }: { children: ReactNode }) => {
  const { ready, authenticated, user } = usePrivy()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ready || !authenticated || !pusher) return
    console.log('PriceAlert provider use effect')

    const room = user?.id.split(':').at(-1)
    if (!room) return

    const userChannel = pusher.subscribe(room)
    userChannel.bind('priceAlert', (data: any) => {
      try {
        console.log('receive price alert', data)
        if (!data.message.includes('TEST')) {
          toast.info(data.message)
        }
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } catch (error) {
        console.error('Failed to parse price alert:', error)
      }
    })

    return () => {
      pusher.disconnect()
    }
  }, [ready, authenticated, user, queryClient])

  return (
    <PriceAlertContext.Provider value={{ pusher }}>
      {children}
    </PriceAlertContext.Provider>
  )
}

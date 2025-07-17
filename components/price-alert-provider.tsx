'use client'

import { usePrivy } from '@privy-io/react-auth'
import { createContext, ReactNode, useContext, useEffect } from 'react'
import { toast } from 'sonner'
import { priceAlertUrl } from '@/lib/pubsub/eth-price-alert'

interface PriceAlertContextType {
  eventSource: EventSource | null
}

const PriceAlertContext = createContext<PriceAlertContextType>({ eventSource: null })
export const usePriceAlert = () => useContext(PriceAlertContext)

export const PriceAlertProvider = ({ children }: { children: ReactNode }) => {
  const { ready, authenticated, user } = usePrivy()

  useEffect(() => {
    if (!ready || !authenticated) return
    console.log('PriceAlert provider use effect')

    const room = user?.id.split(':').at(-1)
    if (!room) return

    const eventSource = new EventSource(`${priceAlertUrl}/events/${room}`)

    eventSource.onopen = () => {
      console.log('PriceAlert connected, subscribing to room', room)
    }

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data)
        console.log('receive price alert', data.message)
        if (!data.message.includes('TEST')) {
          toast.info(data.message)
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error)
      }
    }

    eventSource.onerror = error => {
      console.error('EventSource failed:', error)
    }

    return () => {
      eventSource.close()
    }
  }, [ready, authenticated, user])

  return (
    <PriceAlertContext.Provider value={{ eventSource: null }}>
      {children}
    </PriceAlertContext.Provider>
  )
}

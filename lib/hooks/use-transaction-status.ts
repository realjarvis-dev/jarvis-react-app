'use client'

import { useEffect, useState } from 'react'

export type TransactionStatus =
  | 'preparing'
  | 'building'
  | 'signing'
  | 'broadcasting'
  | 'confirming'
  | 'confirmed'
  | 'failed'

export function useTransactionStatus(toolState: string, result: any) {
  const [status, setStatus] = useState<TransactionStatus>('preparing')

  useEffect(() => {
    if (toolState === 'call') {
      const statusSequence: Array<{
        status: TransactionStatus
        delay: number
      }> = [
        { status: 'preparing', delay: 1000 },
        { status: 'building', delay: 2000 },
        { status: 'signing', delay: 2000 },
        { status: 'broadcasting', delay: 1500 },
        { status: 'confirming', delay: 2500 }
      ]

      let timeoutId: NodeJS.Timeout | null = null
      let currentIndex = 0

      const advanceStatus = () => {
        if (currentIndex < statusSequence.length) {
          const { status, delay } = statusSequence[currentIndex]
          setStatus(status)
          currentIndex++
          timeoutId = setTimeout(advanceStatus, delay)
        }
      }
      advanceStatus()
      return () => {
        if (timeoutId) clearTimeout(timeoutId)
      }
    } else if (toolState === 'result' && result) {
      const data = result?.data || result
      setStatus(data.success ? 'confirmed' : 'failed')
    }
  }, [toolState, result])

  return status
}

'use client'

import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import useLocalStorage from 'use-local-storage-state'

const MAX_TRIALS = 2

export function useAuthHeaders() {
  const { user, ready, authenticated } = usePrivy()
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const [anonId, setAnonId] = useLocalStorage('anonUserId', {
    defaultValue: ''
  })

  useEffect(() => {
    if (!ready) return

    // Defer header setup to avoid blocking LCP
    const timeoutId = setTimeout(() => {
      if (!authenticated) {
        if (!anonId) {
          const newAnonId = crypto.randomUUID()
          console.log('anonId', newAnonId)
          setAnonId(newAnonId)
          setHeaders({
            'x-user-id': newAnonId,
            'allow-web3-tools': 'false'
          })
        } else {
          setHeaders({
            'x-user-id': anonId,
            'allow-web3-tools': 'false'
          })
        }
        return
      } else {
        // Handle authenticated users
        ;(async () => {
          try {
            const token = await getAccessToken()
            setHeaders({
              'x-user-id': user!.id,
              'allow-web3-tools': 'true'
            })
          } catch (error) {
            console.error('Failed to get access token:', error)
            setHeaders({
              'x-user-id': 'anonymous',
              'allow-web3-tools': 'false'
            })
          }
        })()
      }
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [user?.id, ready, authenticated, anonId, setAnonId])

  return { headers, ready, authenticated }
}

export function useTrialLimits() {
  const { authenticated, ready } = usePrivy()
  const [anonTrial, setAnonTrial] = useLocalStorage('anonTrial', {
    defaultValue: MAX_TRIALS
  })

  const checkTrialLimit = (
    limitReachCallback: () => void,
    limitNotReachedCallback: () => void
  ) => {
    if (!ready) {
      return
    }
    if (authenticated) {
      limitNotReachedCallback()
      return
    }
    if (anonTrial <= 0) {
      console.log('anonTrial', anonTrial)
      limitReachCallback()
      return
    }

    setAnonTrial(anonTrial - 1)
    limitNotReachedCallback()
  }

  return { checkTrialLimit, anonTrial, authenticated, ready }
}
'use client'

import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import useLocalStorage from 'use-local-storage-state'

const MAX_TRIALS = 2

export function useAuthHeaders() {
  // Simplified for LCP testing - no Privy hooks
  const [headers] = useState<Record<string, string>>({
    'x-user-id': 'anonymous',
    'allow-web3-tools': 'false'
  })

  return { headers, ready: true, authenticated: false }
}

export function useTrialLimits() {
  // Simplified for LCP testing
  const checkTrialLimit = (
    limitReachCallback: () => void,
    limitNotReachedCallback: () => void
  ) => {
    limitNotReachedCallback() // Always allow for testing
  }

  return { checkTrialLimit, anonTrial: 2, authenticated: false, ready: true }
}
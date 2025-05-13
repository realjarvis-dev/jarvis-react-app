'use client'

import { WalletBalanceResult } from '@/lib/utils/wallet'
import { useCallback, useEffect, useState } from 'react'

export function useWalletBalances(walletAddress?: string) {
  const [balances, setBalances] = useState<WalletBalanceResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Define fetchBalances as a memoized function to avoid recreation on each render
  const fetchBalances = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const url = walletAddress
        ? `/api/wallet/balances?address=${encodeURIComponent(walletAddress)}`
        : '/api/wallet/balances'

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch wallet balances')
      }
      const data = await response.json()
      setBalances(data)
    } catch (err) {
      console.error('Error in useWalletBalances:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  // Use the same function for the initial fetch
  useEffect(() => {
    // Add a small delay for the initial fetch
    const timer = setTimeout(() => {
      fetchBalances()
    }, 0)

    return () => clearTimeout(timer)
  }, [fetchBalances])

  // Expose the same function for manual refetching
  return { balances, isLoading, error, refetch: fetchBalances }
}

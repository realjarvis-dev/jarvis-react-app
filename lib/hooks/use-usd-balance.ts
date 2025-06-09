'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@/lib/network/context'
import { usePrivy } from '@privy-io/react-auth'
import { useEffect } from 'react'

export function useUsdBalance() {
    const { selectedChain, isDemoMode, allChainTypes } = useNetwork()
    const { user, ready, authenticated } = usePrivy()
    const { data, isLoading, error } = useQuery({
        queryKey: ['usdBalance', selectedChain, isDemoMode, user?.id, ready, authenticated],
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
    return { data, isLoading, error }
}
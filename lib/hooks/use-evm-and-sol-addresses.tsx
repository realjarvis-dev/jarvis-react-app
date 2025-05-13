import { useMemo } from 'react'

/**
 * Returns the first EVM (Ethereum-family) and Solana wallet addresses
 * found in `user.linkedAccounts`.
 *
 * @param user – The Privy user object
 */
export function useWalletAddresses(ready: boolean, authenticated: boolean, user?: { linkedAccounts?: any[] } | null) {
  const { evmAddress, solAddress } = useMemo(() => {
    if (!ready || !authenticated || !user) return { evmAddress: '', solAddress: '' }
    const evm = user?.linkedAccounts?.find(
      (acc) => acc.chainType === 'ethereum' && acc.address && acc.connectorType === 'embedded'
    )
    const sol = user?.linkedAccounts?.find(
      (acc) => acc.chainType === 'solana' && acc.address && acc.connectorType === 'embedded'
    )

    return {
      evmAddress: evm?.address ?? '',
      solAddress: sol?.address ?? ''
    }
  }, [user?.linkedAccounts, ready, authenticated])

  return { evmAddress, solAddress }
}

export function getWalletAddresses(user?: { linkedAccounts?: any[] } | null) {
    console.log("user in getWalletAddresses", user)
  if (!user) return { evmAddress: '', solAddress: '' }
  const evm = user?.linkedAccounts?.find(
    (acc) => acc.chainType === 'ethereum' && acc.address
  )
  const sol = user?.linkedAccounts?.find(
    (acc) => acc.chainType === 'solana' && acc.address
  )
  console.log("evm", evm)
  console.log("sol", sol)
  return { evmAddress: evm?.address ?? '', solAddress: sol?.address ?? '' }
}

'use client'

import { useEffect } from 'react'
import { usePrivy, useWallets, useSolanaWallets, useHeadlessDelegatedActions } from '@privy-io/react-auth'
import { useWalletAddresses } from '@/lib/hooks/use-evm-and-sol-addresses'
import { CopyableWalletAddress } from '../copyable-wallet-address'

interface WalletComponentProps {
  showVideoBg?: boolean
}

export function WalletComponent({ showVideoBg }: WalletComponentProps) {
  const { ready, authenticated, user, login } = usePrivy()
  
  // These hooks are now only loaded when the wallet component is rendered
  const { wallets } = useWallets()
  const { wallets: solWallets } = useSolanaWallets()
  const { delegateWallet } = useHeadlessDelegatedActions()
  const { evmAddress, solAddress } = useWalletAddresses(ready, authenticated, user)

  // Measure wallet initialization time
  useEffect(() => {
    if (ready && (wallets.length > 0 || solWallets.length > 0)) {
      // Mark the end of wallet initialization for performance measurement
      if (typeof window !== 'undefined' && window.measureWalletInitTime) {
        window.measureWalletInitTime()
      }
    }
  }, [ready, wallets.length, solWallets.length])

  // Handle wallet delegation on first login
  useEffect(() => {
    if (
      ready &&
      authenticated &&
      wallets.length > 0 &&
      !user?.linkedAccounts?.find(
        account => account.type === 'wallet' && account.delegated
      )
    ) {
      // Delegate actions to the first wallet
      delegateWallet({ address: wallets[0].address, chainType: 'ethereum' })
    }
  }, [ready, authenticated, wallets, user?.linkedAccounts, delegateWallet])

  // If not authenticated, show login button
  if (!authenticated) {
    return (
      <button
        onClick={login}
        className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
          showVideoBg
            ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        }`}
      >
        Login
      </button>
    )
  }

  // If authenticated but no wallet addresses, show a message
  if (!evmAddress && !solAddress) {
    return (
      <div className={`text-xs sm:text-sm ${showVideoBg ? 'text-white/80' : 'text-muted-foreground'}`}>
        No wallet connected
      </div>
    )
  }

  // Show wallet addresses
  return (
    <div className="flex flex-col items-center gap-1">
      {evmAddress && (
        <CopyableWalletAddress
          walletAddress={evmAddress}
          walletAddressIntroText="EVM wallet:"
          className={showVideoBg ? 'text-white/90' : ''}
        />
      )}
      {solAddress && (
        <CopyableWalletAddress
          walletAddress={solAddress}
          walletAddressIntroText="Solana wallet:"
          className={showVideoBg ? 'text-white/90' : ''}
        />
      )}
    </div>
  )
}

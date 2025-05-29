'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { WalletComponent } from './wallet-component'

interface LazyWalletProps {
  showVideoBg?: boolean
}

/**
 * LazyWallet component that only loads wallet functionality when needed
 * This separates Privy auth from wallet loading for better performance
 */
export function LazyWallet({ showVideoBg }: LazyWalletProps) {
  const [showWallet, setShowWallet] = useState(false)
  const { login } = usePrivy()

  // If wallet is not loaded yet, show login button
  if (!showWallet) {
    return (
      <button
        onClick={() => {
          // Mark the start of wallet initialization for performance measurement
          if (typeof window !== 'undefined' && window.markWalletInitStart) {
            window.markWalletInitStart()
          }
          login()
          setShowWallet(true)
        }}
        className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
          showVideoBg
            ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        }`}
      >
        Connect Wallet
      </button>
    )
  }

  // Once button is clicked, load the full wallet component
  return <WalletComponent showVideoBg={showVideoBg} />
}

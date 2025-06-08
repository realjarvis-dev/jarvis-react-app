'use client'

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
  const { authenticated } = usePrivy()
  return <WalletComponent showVideoBg={showVideoBg} />
}

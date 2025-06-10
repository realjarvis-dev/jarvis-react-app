'use client'

import { useWalletAddresses } from '@/lib/hooks/use-evm-and-sol-addresses'
import { useHeadlessDelegatedActions, usePrivy, useSolanaWallets, useWallets } from '@privy-io/react-auth'
import { useEffect } from 'react'
import { CopyableWalletAddress } from '../copyable-wallet-address'

// Function to check and fund user wallet if needed
const checkAndFundUserWallet = async (retries = 3): Promise<void> => {
  try {
    console.log(`Checking and funding wallet (retries left: ${retries})`)
    
    // Call the wallet funding API
    const response = await fetch('/api/wallet/fund', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error('Error funding wallet:', data.error)
      
      // Retry if we have retries left and it's a recoverable error
      if (retries > 0 && (data.error?.includes('No wallet address found') || data.error?.includes('ETH token not found'))) {
        console.log(`Will retry wallet funding in 3 seconds... (${retries} retries left)`)
        setTimeout(() => checkAndFundUserWallet(retries - 1), 3000)
      }
      return
    }
    
    if (data.funded) {
      console.log('Wallet funded successfully. Previous balance:', data.previousBalance)
    } else {
      console.log('Wallet already has sufficient balance:', data.currentBalance)
    }
  } catch (error) {
    console.error('Error in checkAndFundUserWallet:', error)
    
    // Retry on unexpected errors
    if (retries > 0) {
      console.log(`Will retry wallet funding in 3 seconds... (${retries} retries left)`)
      setTimeout(() => checkAndFundUserWallet(retries - 1), 3000)
    }
  }
}

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

  // Handle wallet delegation on first login and fund wallet
  useEffect(() => {
    if (ready && authenticated && wallets.length > 0) { 
      // Check and fund wallet once wallets are ready
      checkAndFundUserWallet()
    }
  }, [ready, authenticated, wallets, user?.id])

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
      {/* {solAddress && (
        <CopyableWalletAddress
          walletAddress={solAddress}
          walletAddressIntroText="Solana wallet:"
          className={showVideoBg ? 'text-white/90' : ''}
        />
      )} */}
    </div>
  )
}

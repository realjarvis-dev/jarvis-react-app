'use client'

import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import {
    useLogin,
    usePrivy,
    type LinkedAccountWithMetadata,
    type User
} from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import GuestMenu from './guest-menu'
import UserMenu from './user-menu'
import WelcomePopup from './welcome-popup'

// Function to check and fund user wallet if needed
const checkAndFundUserWallet = async (): Promise<void> => {
  try {
    console.log('Checking and funding wallet if needed')
    
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
      return
    }
    
    if (data.funded) {
      console.log('Wallet funded successfully. Previous balance:', data.previousBalance)
    } else {
      console.log('Wallet already has sufficient balance:', data.currentBalance)
    }
  } catch (error) {
    console.error('Error in checkAndFundUserWallet:', error)
  }
}

export const Header: React.FC = () => {
  const { open } = useSidebar()
  const { authenticated, ready } = usePrivy()
  const router = useRouter()
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const handleCloseWelcomePopup = () => {
    setShowWelcomePopup(false)
    router.push('/')
  }
  const { login } = useLogin({
    onError: async error => {
      console.error('Error during login:', error)
    },
    onComplete: async (params: {
      user: User
      isNewUser: boolean
      wasAlreadyAuthenticated: boolean
      loginMethod: any | null
      loginAccount: LinkedAccountWithMetadata | null
    }) => {
      try {
        const { user, isNewUser, wasAlreadyAuthenticated } = params
        console.log('Login complete in Header:', params)

        // Check and fund user wallet after successful login
        await checkAndFundUserWallet()

        if (isNewUser) {
          setShowWelcomePopup(true)
        } else if (!wasAlreadyAuthenticated) {
          router.push("/")
          router.refresh()
        }
        // always show welcome popup, for demo purposes
        // setShowWelcomePopup(true)
        // if (solWallet?.delegated && solWallet.address) {
        //   delegateWallet({ address: solWallet.address, chainType: 'solana' })
        // }
      } catch (error) {
        console.error('Error during login onComplete in Header:', error)
      }
    }
  })


  return (
    <header
      className={cn(
        'fixed top-0 right-0 p-2 flex justify-between items-center z-10 backdrop-blur-none bg-transparent transition-[width] duration-200 ease-linear',
        open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
        'w-full'
      )}
    >
      <WelcomePopup open={showWelcomePopup} onClose={handleCloseWelcomePopup}/>
      <div className="flex items-center space-x-4">
        <a href="/">
          {/* <IconLogo className={cn('w-5 h-5')} /> */}
          <span className="sr-only">Jarvis</span>
        </a>
      </div>

      <div className="flex items-center gap-2">
        {ready && authenticated ? <UserMenu /> : <GuestMenu login={login} />}
      </div>
    </header>
  )
}

export default Header

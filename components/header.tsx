'use client'

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import {
  useHeadlessDelegatedActions,
  useLogin,
  usePrivy,
  WalletWithMetadata,
  type LinkedAccountWithMetadata,
  type User
} from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import GuestMenu from './guest-menu'
import UserMenu from './user-menu'
import WelcomePopup from './welcome-popup'

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
        'fixed top-0 left-0 right-0 h-14 px-4 flex justify-between items-center z-50 bg-transparent border-b border-border/20',
        'safe-area-inset-top'
      )}
    >
      <WelcomePopup open={showWelcomePopup} onClose={handleCloseWelcomePopup}/>
      <div className="flex items-center gap-2">
        {ready && authenticated && <SidebarTrigger />}
        <a href="/" className="flex items-center gap-2">
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

'use client'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import {
    useHeadlessDelegatedActions,
    useLogin,
    usePrivy,
    WalletWithMetadata,
    type LinkedAccountWithMetadata,
    type User
} from '@privy-io/react-auth'
import { ArrowLeft } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import React, { useState } from 'react'
import GuestMenu from './guest-menu'
import UserMenu from './user-menu'
import WalletMenu from './wallet-menu'
import WelcomePopup from './welcome-popup'

export const Header: React.FC = () => {
  const { open } = useSidebar()
  const { authenticated, ready } = usePrivy()
  const router = useRouter()
  const pathname = usePathname()
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  
  const isWalletSummaryPage = pathname === '/wallet/summary'
  
  const handleCloseWelcomePopup = () => {
    setShowWelcomePopup(false)
    router.push('/')
  }
  const { delegateWallet } = useHeadlessDelegatedActions()
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
          // delegate the evm wallet here
          const evmWallet = user.linkedAccounts.find((account) => account.type === 'wallet' && account.chainType === 'ethereum') as WalletWithMetadata
          if (evmWallet) {
            console.log('Delegating evm wallet in Header:', evmWallet)
            delegateWallet({ address: evmWallet.address, chainType: 'ethereum' })
          }
        } else if (!wasAlreadyAuthenticated) {
          router.push("/")
          router.refresh()
        } else {
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
        'fixed top-0 right-0 p-2 flex justify-between items-center z-10 backdrop-blur lg:backdrop-blur-none lg:bg-transparent transition-[width] duration-200 ease-linear',
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
        {ready && authenticated && isWalletSummaryPage && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="ring-0 outline-none focus:ring-0 focus:outline-none focus:shadow-none active:ring-0 active:outline-none active:shadow-none bg-transparent hover:bg-transparent active:bg-transparent rounded-md"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        {ready && authenticated && <WalletMenu />}
        {ready && authenticated ? <UserMenu /> : <GuestMenu login={login} />}
      </div>
    </header>
  )
}

export default Header

'use client'

import { ArrowLeft, Wallet } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from './ui/button'

export default function WalletMenu() {
  const router = useRouter()
  const pathname = usePathname()

  const isWalletPage = pathname === '/wallet'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="ring-0 outline-none focus:ring-0 focus:outline-none focus:shadow-none active:ring-0 active:outline-none active:shadow-none bg-transparent hover:bg-transparent active:bg-transparent rounded-md"
      onClick={() => router.push(isWalletPage ? '/' : '/wallet')}
    >
      {isWalletPage ? (
        <ArrowLeft className="w-4 h-4" />
      ) : (
        <Wallet className="w-4 h-4" />
      )}
    </Button>
  )
}

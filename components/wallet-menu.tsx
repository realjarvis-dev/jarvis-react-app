'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { useWallets } from '@privy-io/react-auth'
import { Info, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { CopyableWalletAddress } from './copyable-wallet-address'
import { Button } from './ui/button'

export default function WalletMenu() {
  const router = useRouter()
  const { wallets } = useWallets()
  const wallet = wallets[0]

  return (
        <Button variant="ghost" 
        size="icon" 
        className="ring-0 outline-none focus:ring-0 focus:outline-none focus:shadow-none active:ring-0 active:outline-none active:shadow-none bg-transparent hover:bg-transparent active:bg-transparent rounded-md"
        onClick={() => router.push('/wallet')}>
          <Wallet className="w-4 h-4" />
        </Button>
  )
}

'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, Clock, XCircle } from 'lucide-react'

interface KodiakDepositStatusProps {
  status: 'preparing' | 'calculating' | 'approving' | 'swapping' | 'depositing' | 'confirming' | 'confirmed' | 'failed'
  txHash?: string
  islandName?: string
  chainId?: number
}

export function KodiakDepositStatus({
  status,
  txHash,
  islandName,
  chainId = 80084 // Berachain Artio testnet
}: KodiakDepositStatusProps) {
  // Berachain explorer URL
  const explorerBaseUrl = 'https://berascan.com'

  // Get appropriate color based on status
  const getStatusColor = () => {
    switch (status) {
      case 'preparing':
      case 'calculating':
        return 'text-blue-600 dark:text-blue-400'
      case 'approving':
      case 'swapping':
      case 'depositing':
      case 'confirming':
        return 'text-amber-600 dark:text-amber-400'
      case 'confirmed':
        return 'text-green-600 dark:text-green-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Get icon based on status
  const getStatusIcon = () => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 mr-1" />
      case 'failed':
        return <XCircle className="h-4 w-4 mr-1" />
      default:
        return <Clock className="h-4 w-4 mr-1" />
    }
  }

  // Get text based on status
  const getStatusText = () => {
    switch (status) {
      case 'preparing':
        return `Preparing deposit${islandName ? ` to ${islandName}` : ''}`
      case 'calculating':
        return 'Calculating optimal swap amounts'
      case 'approving':
        return 'Approving token spending'
      case 'swapping':
        return 'Swapping tokens for optimal ratio'
      case 'depositing':
        return `Depositing to ${islandName || 'Kodiak Island'}`
      case 'confirming':
        return 'Waiting for blockchain confirmation'
      case 'confirmed':
        return `Deposit confirmed${islandName ? ` to ${islandName}` : ''}`
      case 'failed':
        return 'Deposit transaction failed'
      default:
        return 'Processing deposit'
    }
  }

  return (
    <div className="flex items-center justify-between w-full">
      <div className={cn("flex items-center text-sm font-medium", getStatusColor())}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>
      
      {/* Show TX hash if available and confirmed */}
      {txHash && status === 'confirmed' && (
        <a 
          href={`${explorerBaseUrl}/tx/${txHash}`} 
          target="_blank" 
          rel="noreferrer"
          className="text-xs ml-2 font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          View transaction
        </a>
      )}
    </div>
  )
} 
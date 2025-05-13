'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, Clock, XCircle } from 'lucide-react'

interface SwapTransactionStatusProps {
  status: 'preparing' | 'building' | 'signing' | 'broadcasting' | 'confirming' | 'confirmed' | 'failed'
  txHash?: string
  tokenName?: string
}

export function SwapTransactionStatus({
  status,
  txHash,
  tokenName
}: SwapTransactionStatusProps) {
  
  // Get appropriate color based on status
  const getStatusColor = () => {
    switch (status) {
      case 'preparing':
      case 'building':
        return 'text-blue-600 dark:text-blue-400'
      case 'signing':
      case 'broadcasting':
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
        return `Preparing transaction${tokenName ? ` for ${tokenName}` : ''}`
      case 'building':
        return 'Building transaction'
      case 'signing':
        return 'Signing transaction'
      case 'broadcasting':
        return 'Broadcasting to network'
      case 'confirming':
        return 'Waiting for confirmation'
      case 'confirmed':
        return `Transaction confirmed${tokenName ? ` for ${tokenName}` : ''}`
      case 'failed':
        return 'Transaction failed'
      default:
        return 'Processing'
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
          href={`https://etherscan.io/tx/${txHash}`} 
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
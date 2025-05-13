'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Clock, Link, Loader2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SwapTransactionStatus } from './swap-transaction-status'

interface SwapTransactionCardProps {
  tool: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type TransactionStatus = 'preparing' | 'building' | 'signing' | 'broadcasting' | 'confirming' | 'confirmed' | 'failed'

export function SwapTransactionCard({
  tool,
  isOpen,
  onOpenChange
}: SwapTransactionCardProps) {
  const [status, setStatus] = useState<TransactionStatus>('preparing')
  const [tokenName, setTokenName] = useState<string>('PT/YT Token')
  
  // Parse the result
  const result = tool.result
    ? typeof tool.result === 'string'
      ? JSON.parse(tool.result)
      : tool.result
    : null

  // Attempt to determine token name from the args (market address)
  useEffect(() => {
    if (tool.args?.market_address && tool.args?.token_out_address) {
      // Check if we have a known token name pattern in the market address
      const marketAddress = tool.args.market_address.toLowerCase()
      
      // Common Pendle markets that can be recognized
      const marketPatterns = [
        { pattern: 'weeth', name: 'weETH' },
        { pattern: 'rseth', name: 'rsETH' },
        { pattern: 'steth', name: 'stETH' },
        { pattern: 'reth', name: 'rETH' },
        { pattern: 'cbeth', name: 'cbETH' },
        { pattern: 'sfrxeth', name: 'sfrxETH' },
        { pattern: 'ezeth', name: 'ezETH' },
        { pattern: 'sweth', name: 'swETH' },
        { pattern: 'weth', name: 'WETH' },
        { pattern: 'ethx', name: 'ETHx' }
      ]
      
      // Try to match the market address to a known pattern
      for (const { pattern, name } of marketPatterns) {
        if (marketAddress.includes(pattern)) {
          // We'll prefix with PT or YT based on if this looks like a YT token
          const isYT = tool.args.token_out_address.toLowerCase().includes('yt')
          const prefix = isYT ? 'YT' : 'PT'
          setTokenName(`${prefix} ${name}`)
          break
        }
      }
    }
  }, [tool.args])

  // Also try to extract token info from result
  useEffect(() => {
    if (result?.swap_details?.to && result.swap_details.to !== 'Pendle Token') {
      setTokenName(result.swap_details.to)
    }
  }, [result])

  // Simulate transaction flow for better UX
  useEffect(() => {
    if (tool.state === 'call') {
      // Set up the sequence of status changes for a better UX
      const statusSequence: Array<{ status: TransactionStatus; delay: number }> = [
        { status: 'preparing', delay: 1000 },
        { status: 'building', delay: 2000 },
        { status: 'signing', delay: 2000 },
        { status: 'broadcasting', delay: 1500 },
        { status: 'confirming', delay: 2500 }
      ]

      let timeoutId: NodeJS.Timeout | null = null
      let currentIndex = 0

      const advanceStatus = () => {
        if (currentIndex < statusSequence.length) {
          const { status, delay } = statusSequence[currentIndex]
          setStatus(status)
          currentIndex++
          timeoutId = setTimeout(advanceStatus, delay)
        }
      }

      // Start the sequence
      advanceStatus()

      // Cleanup function
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    } else if (tool.state === 'result' && result) {
      setStatus(result.success ? 'confirmed' : 'failed')
    }
  }, [tool.state, result])

  // Get appropriate icon and text for current status
  const getStatusInfo = (status: TransactionStatus) => {
    switch (status) {
      case 'preparing':
        return { 
          icon: <Clock className="h-4 w-4" />, 
          text: 'Preparing transaction', 
          color: 'text-blue-600 dark:text-blue-400' 
        }
      case 'building':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Building transaction', 
          color: 'text-blue-600 dark:text-blue-400' 
        }
      case 'signing':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Signing transaction', 
          color: 'text-amber-600 dark:text-amber-400' 
        }
      case 'broadcasting':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Broadcasting to network', 
          color: 'text-amber-600 dark:text-amber-400' 
        }
      case 'confirming':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Waiting for confirmation', 
          color: 'text-amber-600 dark:text-amber-400' 
        }
      case 'confirmed':
        return { 
          icon: <CheckCircle className="h-4 w-4" />, 
          text: 'Transaction confirmed', 
          color: 'text-green-600 dark:text-green-400' 
        }
      case 'failed':
        return { 
          icon: <AlertCircle className="h-4 w-4" />, 
          text: 'Transaction failed', 
          color: 'text-red-600 dark:text-red-400' 
        }
      default:
        return { 
          icon: <Clock className="h-4 w-4" />, 
          text: 'Processing', 
          color: 'text-gray-600 dark:text-gray-400' 
        }
    }
  }

  // Get status badge based on current status
  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'preparing':
      case 'building':
      case 'signing':
      case 'broadcasting':
      case 'confirming':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        )
      case 'confirmed':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
    }
  }

  // Progress steps for transaction flow
  const steps = [
    { id: 'preparing', label: 'Preparing' },
    { id: 'building', label: 'Building' },
    { id: 'signing', label: 'Signing' },
    { id: 'broadcasting', label: 'Broadcasting' },
    { id: 'confirming', label: 'Confirming' }
  ]

  // Get current status for display in child components
  const getCurrentStatus = () => status;
  
  // Get transaction hash when available
  const getTransactionHash = () => {
    if (result && result.success && result.transaction_hash) {
      return result.transaction_hash;
    }
    return undefined;
  };

  // If tool is in call state, show pending UI with steps
  if (tool.state === 'call') {
    const statusInfo = getStatusInfo(status)
    const currentStepIndex = steps.findIndex(step => step.id === status)
    
    return (
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">Swap Transaction</h3>
              {getStatusBadge(status)}
            </div>
            
            {/* Progress steps */}
            <div className="relative">
              <div className="absolute left-0 top-1/2 w-full h-0.5 -translate-y-1/2 bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex justify-between relative">
                {steps.map((step, index) => {
                  const isActive = index <= currentStepIndex
                  const isCurrent = index === currentStepIndex
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center relative">
                      <div 
                        className={cn(
                          "w-3 h-3 rounded-full z-10",
                          isActive 
                            ? "bg-blue-600 dark:bg-blue-400" 
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      />
                      <span 
                        className={cn(
                          "text-xs mt-1",
                          isCurrent 
                            ? "font-medium text-blue-600 dark:text-blue-400" 
                            : isActive 
                              ? "text-gray-600 dark:text-gray-300" 
                              : "text-gray-400 dark:text-gray-500"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Current status */}
            <div className={cn("flex items-center text-sm font-medium", statusInfo.color)}>
              {statusInfo.icon}
              <span className="ml-2">{statusInfo.text}</span>
            </div>
            
            {/* Add status component for consistency */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 mt-2">
              <SwapTransactionStatus status={status} tokenName={tokenName} />
            </div>
            
            {/* Transaction data (if any) */}
            {tool.args && (
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 text-sm mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-500 dark:text-gray-400">Amount:</div>
                  <div>{tool.args.amount_in_eth} ETH</div>
                  <div className="text-gray-500 dark:text-gray-400">To:</div>
                  <div>{tokenName}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // If there's no result yet, don't show anything
  if (!result) {
    return null
  }

  // If there's an error, show error UI
  if (result.error || !result.success) {
    return (
      <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">Swap Transaction</h3>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            </div>
            
            <div className="text-red-600 dark:text-red-400 text-sm font-medium">
              {result.error || 'Transaction failed'}
            </div>
            
            {result.swap_details && (
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-500 dark:text-gray-400">Amount:</div>
                  <div>{result.swap_details.amount}</div>
                  <div className="text-gray-500 dark:text-gray-400">Market:</div>
                  <div className="truncate">{result.swap_details.market}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success UI
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border border-green-100 dark:border-green-900">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-green-100 dark:border-green-900">
            <h3 className="text-base font-medium">Swap Transaction</h3>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Confirmed
            </Badge>
          </div>
          
          {/* Add status component at the top */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
            <SwapTransactionStatus status={status} txHash={getTransactionHash()} tokenName={tokenName} />
          </div>
          
          {/* Transaction Details */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col space-y-3">
              {/* From/To */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">From:</div>
                <div className="text-sm font-medium">{result.swap_details?.from || 'ETH'}</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">To:</div>
                <div className="text-sm font-medium">{tokenName}</div>
              </div>
              
              {/* Amount */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">Amount:</div>
                <div className="text-sm font-bold">{result.swap_details?.amount || 'N/A'}</div>
              </div>
              
              {/* Transaction Hash */}
              <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Transaction:</div>
                  <a 
                    href={`https://etherscan.io/tx/${result.transaction_hash}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center hover:underline"
                  >
                    {result.transaction_hash.slice(0, 8)}...{result.transaction_hash.slice(-6)}
                    <Link className="h-3 w-3 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Small timestamp note */}
          <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            Transaction completed at {new Date().toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
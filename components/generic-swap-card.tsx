'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Link as LinkIcon,
  Loader2,
  XCircle
} from 'lucide-react'
import { useEffect, useState } from 'react'
// Assuming a similar status component exists or will be created for swaps
import { getConfigByChainId } from '@/lib/config/network'
import { SwapTransactionStatus } from './swap-transaction-status' // Re-use or adapt this
interface GenericSwapCardProps {
  tool: any // The AI tool invocation, specifically genericSwapTool
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type TransactionStatus =
  | 'preparing'
  | 'building'
  | 'signing'
  | 'broadcasting'
  | 'confirming'
  | 'confirmed'
  | 'failed'

export function GenericSwapCard({
  tool,
  isOpen,
  onOpenChange
}: GenericSwapCardProps) {
  const [status, setStatus] = useState<TransactionStatus>('preparing')
  const [displayTokenIn, setDisplayTokenIn] = useState<string>('ETH')
  const [displayTokenOut, setDisplayTokenOut] = useState<string>('Token')

  // Parse the result and arguments
  const result = tool.result
    ? typeof tool.result === 'string'
      ? JSON.parse(tool.result)
      : tool.result
    : null

  const args = tool.args
    ? typeof tool.args === 'string'
      ? JSON.parse(tool.args)
      : tool.args
    : null

  // Update display token names from arguments and result
  useEffect(() => {
    if (args?.tokenInSymbol) {
      setDisplayTokenIn(args.tokenInSymbol.toUpperCase())
    }
    if (args?.tokenOutSymbol) {
      setDisplayTokenOut(args.tokenOutSymbol)
    } else if (args?.tokenOutAddress) {
      // Fallback to a short address if symbol isn't provided
      setDisplayTokenOut(`${args.tokenOutAddress.slice(0, 6)}...`)
    }

    // If result provides more specific names, prefer those
    if (result?.swap_details?.from_token_symbol) {
      setDisplayTokenIn(result.swap_details.from_token_symbol.toUpperCase())
    }
    if (
      result?.swap_details?.to_token_symbol &&
      result.swap_details.to_token_symbol !== 'Token'
    ) {
      setDisplayTokenOut(result.swap_details.to_token_symbol)
    }
  }, [args, result])

  // Simulate transaction flow for better UX (similar to SwapTransactionCard)
  useEffect(() => {
    if (tool.state === 'call') {
      const statusSequence: Array<{
        status: TransactionStatus
        delay: number
      }> = [
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
      advanceStatus()
      return () => {
        if (timeoutId) clearTimeout(timeoutId)
      }
    } else if (tool.state === 'result' && result) {
      setStatus(result.success ? 'confirmed' : 'failed')
    }
  }, [tool.state, result])

  // Status info (icon, text, color)
  const getStatusInfo = (currentStatus: TransactionStatus) => {
    switch (currentStatus) {
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

  // Status badge
  const getStatusBadge = (currentStatus: TransactionStatus) => {
    switch (currentStatus) {
      case 'preparing':
      case 'building':
      case 'signing':
      case 'broadcasting':
      case 'confirming':
        return (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
          >
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

  const steps = [
    { id: 'preparing', label: 'Preparing' },
    { id: 'building', label: 'Building' },
    { id: 'signing', label: 'Signing' },
    { id: 'broadcasting', label: 'Broadcasting' },
    { id: 'confirming', label: 'Confirming' }
  ]

  const getTransactionHash = () =>
    result?.success && result.transaction_hash
      ? result.transaction_hash
      : undefined
  const chainId = args?.chainId || result?.swap_details?.chain_id || 1 // Default to Ethereum mainnet
  const etherscanBaseUrl = `https://${getConfigByChainId(chainId).scanLink}/tx/`

  // Pending UI
  if (tool.state === 'call') {
    const statusInfo = getStatusInfo(status)
    const currentStepIndex = steps.findIndex(step => step.id === status)
    return (
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">Swap</h3>
              {getStatusBadge(status)}
            </div>
            <div className="relative">
              <div className="absolute left-0 top-1/2 w-full h-0.5 -translate-y-1/2 bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex justify-between relative">
                {steps.map((step, index) => {
                  const isActive = index <= currentStepIndex
                  const isCurrent = index === currentStepIndex
                  return (
                    <div
                      key={step.id}
                      className="flex flex-col items-center relative"
                    >
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full z-10',
                          isActive
                            ? 'bg-blue-600 dark:bg-blue-400'
                            : 'bg-gray-300 dark:bg-gray-600'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs mt-1',
                          isCurrent
                            ? 'font-medium text-blue-600 dark:text-blue-400'
                            : isActive
                            ? 'text-gray-600 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500'
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div
              className={cn(
                'flex items-center text-sm font-medium',
                statusInfo.color
              )}
            >
              {statusInfo.icon}
              <span className="ml-2">{statusInfo.text}</span>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 mt-2">
              <SwapTransactionStatus
                status={status}
                tokenName={displayTokenOut}
              />
            </div>
            {args && (
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 text-sm mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-500 dark:text-gray-400">
                    Amount:
                  </div>
                  <div>
                    {args.amountInHuman} {displayTokenIn}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">To:</div>
                  <div>{displayTokenOut}</div>
                  {args.protocol != 'none' && (
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">
                        Protocol:
                      </div>
                      <div>{args.protocol}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!result) return null // No result yet

  // Error UI
  if (result.error || !result.success) {
    return (
      <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">Swap Failed</h3>
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
                  <div className="text-gray-500 dark:text-gray-400">
                    Amount:
                  </div>
                  <div>{result.swap_details.amount_in_human}</div>
                  <div className="text-gray-500 dark:text-gray-400">To:</div>
                  <div className="truncate">
                    {result.swap_details.to_token_symbol ||
                      result.swap_details.to_token_address}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Protocol:
                  </div>
                  <div>{result.swap_details.protocol}</div>
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
            <h3 className="text-base font-medium">Swap Successful</h3>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Confirmed
            </Badge>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
            <SwapTransactionStatus
              status={status}
              txHash={getTransactionHash()}
              tokenName={displayTokenOut}
            />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  From:
                </div>
                <div className="text-sm font-medium">
                  {result.swap_details?.from_token_symbol || displayTokenIn}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  To:
                </div>
                <div className="text-sm font-medium">{displayTokenOut}</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Amount:
                </div>
                <div className="text-sm font-bold">
                  {result.swap_details?.amount_in_human || 'N/A'}
                </div>
              </div>
              {result.swap_details?.protocol != 'none' && (
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Protocol:
                  </div>
                  <div className="text-sm font-medium">
                    {result.swap_details?.protocol || args?.protocol}
                  </div>
                </div>
              )}
              {result.transaction_hash && (
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Transaction:
                    </div>
                    <a
                      href={`${etherscanBaseUrl}/tx/${result.transaction_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center hover:underline"
                    >
                      {result.transaction_hash.slice(0, 8)}...
                      {result.transaction_hash.slice(-6)}
                      <LinkIcon className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            Transaction completed at{' '}
            {new Date(result.swap_details.complete_time).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

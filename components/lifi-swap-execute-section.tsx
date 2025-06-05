'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getConfigByChainId } from '@/lib/network/config'
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
import { SwapTransactionStatus } from './swap-transaction-status'
import { useNetwork } from '@/lib/network/context'

interface LifiSwapExecuteSectionProps {
  tool: any // AI tool invocation, specifically bridgeExecuteTool
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

export function LifiSwapExecuteSection({
  tool,
  isOpen,
  onOpenChange
}: LifiSwapExecuteSectionProps) {
  const [status, setStatus] = useState<TransactionStatus>('preparing')
  const [displayTokenIn, setDisplayTokenIn] = useState<string>('Token In')
  const [displayTokenOut, setDisplayTokenOut] = useState<string>('Token Out')
  const [isBridge, setIsBridge] = useState<boolean>(true)

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

  useEffect(() => {
    if (args?.fromToken) {
      setDisplayTokenIn(args.fromToken.toUpperCase())
    }
    if (args?.toToken) {
      setDisplayTokenOut(args.toToken.toUpperCase())
    }

    if (result?.swap_details?.from_token_symbol) {
      setDisplayTokenIn(result.swap_details.from_token_symbol.toUpperCase())
    }
    if (args?.fromChainName === args?.toChainName) {
      setIsBridge(false)
    }
    // to_token_symbol is not in result.swap_details, rely on args.toToken
  }, [args, result])

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

  const getStatusInfo = (currentStatus: TransactionStatus) => {
    const bridgeText = isBridge ? 'bridge' : 'swap'
    const bridgeTextCapitalized = isBridge ? 'Bridge' : 'Swap'
    switch (currentStatus) {
      case 'preparing':
        return {
          icon: <Clock className="h-4 w-4" />,
          text: `Preparing ${bridgeText} transaction`,
          color: 'text-blue-600 dark:text-blue-400'
        }
      case 'building':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: `Building ${bridgeText} transaction`,
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
          text: `${bridgeTextCapitalized} transaction confirmed`,
          color: 'text-green-600 dark:text-green-400'
        }
      case 'failed':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: `${bridgeTextCapitalized} transaction failed`,
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

  const fromChainId = args?.fromChainId
  const { isDemoMode } = useNetwork()
  const etherscanBaseUrl = fromChainId
    ? getConfigByChainId(fromChainId, isDemoMode).scanLink
    : ''
  
  const toChainId = args?.toChainId
  const toEtherscanBaseUrl = toChainId
    ? getConfigByChainId(toChainId, isDemoMode).scanLink
    : ''

  const bridgeText = isBridge ? 'bridge' : 'swap'
  const bridgeTextCapitalized = isBridge ? 'Bridge' : 'Swap'

  if (tool.state === 'call') {
    const statusInfo = getStatusInfo(status)
    const currentStepIndex = steps.findIndex(step => step.id === status)


    return (
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">{bridgeTextCapitalized}</h3>
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
                tokenName={displayTokenOut} // User is expecting to receive this token
                chainId={fromChainId} // Transaction is on the fromChain
              />
            </div>
            {args && (
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 text-sm mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-500 dark:text-gray-400">
                    Amount:
                  </div>
                  <div>
                    {args.amountIn} {displayTokenIn} on {args.fromChainName}
                  </div>
                  {/* <div className="text-gray-500 dark:text-gray-400">
                    From Chain:
                  </div>
                  <div>{args.fromChainName}</div>
                  <div className="text-gray-500 dark:text-gray-400">
                    To Chain:
                  </div>
                  <div>{args.toChainName}</div> */}
                  <div className="text-gray-500 dark:text-gray-400">
                    Receiving:
                  </div>
                  <div>{displayTokenOut} on {args.toChainName}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!result) return null

  if (result.error || !result.success) {
    return (
      <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">{bridgeTextCapitalized} Failed</h3>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            </div>
            <div className="text-red-600 dark:text-red-400 text-sm font-medium whitespace-pre-wrap break-all">
              {result.error || 'Transaction failed'}
            </div>
            {(result.swap_details || args) && (
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-gray-500 dark:text-gray-400">
                    Amount:
                  </div>
                  <div>
                    {result.swap_details?.amount_in_human || args?.amountIn}{' '}
                    {result.swap_details?.from_token_symbol || args?.fromToken} on {result.swap_details?.from_chain_name || args?.fromChainName}
                  </div>
                  {/* <div className="text-gray-500 dark:text-gray-400">
                    From Chain:
                  </div>
                  <div>
                    {result.swap_details?.from_chain_name ||
                      args?.fromChainName}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    To Chain:
                  </div>
                  <div>
                    {result.swap_details?.to_chain_name || args?.toChainName}
                  </div> */}
                  <div className="text-gray-500 dark:text-gray-400">
                    Expected Token:
                  </div>
                  <div>{args?.toToken} on {result.swap_details?.to_chain_name || args?.toChainName}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border border-green-100 dark:border-green-900">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-green-100 dark:border-green-900">
            <h3 className="text-base font-medium">{bridgeTextCapitalized} Successful</h3>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Confirmed
            </Badge>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
            <SwapTransactionStatus
              status={status} // 'confirmed'
              txHash={getTransactionHash()}
              tokenName={displayTokenOut}
              chainId={fromChainId}
            />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Sent:
                </div>
                <div className="text-sm font-medium">
                  {result.swap_details?.amount_in_human} {displayTokenIn} on {result.swap_details?.from_chain_name || args?.fromChainName}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Receiving:
                </div>
                <div className="text-sm font-medium">{displayTokenOut} on {result.swap_details?.to_chain_name || args?.toChainName}</div>
              </div>
              {result.transaction_hash && etherscanBaseUrl && (
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {"Transaction: " + (result.swap_details?.intermediate_token_symbol ? 
                        (`${result.swap_details?.from_token_symbol} on ${result.swap_details?.from_chain_name}` + 
                        ' -> ' + `${result.swap_details?.intermediate_token_symbol} on ${result.swap_details?.to_chain_name}`) : "")}
                    </div>
                    <a
                      href={`https://${etherscanBaseUrl}/tx/${result.transaction_hash}`}
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
              {result.swap_transaction_hash && toEtherscanBaseUrl && (
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {"Transaction: " + (result.swap_details?.intermediate_token_symbol ? 
                        (`${result.swap_details?.intermediate_token_symbol} on ${result.swap_details?.to_chain_name}` + 
                        ' -> ' + `${args?.toToken} on ${args?.toChainName}`) : "")}
                    </div>
                    <a
                      href={`https://${toEtherscanBaseUrl}/tx/${result.swap_transaction_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center hover:underline"
                    >
                      {result.swap_transaction_hash.slice(0, 8)}...
                      {result.swap_transaction_hash.slice(-6)}
                      <LinkIcon className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
          {result.swap_details?.complete_time && (
            <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
              Transaction completed at{' '}
              {new Date(result.swap_details?.complete_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

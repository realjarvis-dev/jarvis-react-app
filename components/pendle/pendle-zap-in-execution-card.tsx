'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  TransactionStatus,
  useTransactionStatus
} from '@/lib/hooks/use-transaction-status'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Link,
  Loader2,
  XCircle
} from 'lucide-react'
import { SwapTransactionStatus } from '../swap-transaction-status'

interface PendleZapInExecutionCardProps {
  tool: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PendleZapInExecutionCard({
  tool,
  isOpen,
  onOpenChange
}: PendleZapInExecutionCardProps) {
  const result = tool.result
    ? typeof tool.result === 'string'
      ? JSON.parse(tool.result)
      : tool.result
    : null
  console.log('==== PendleZapInExecutionCard RENDERED ====')
  console.log(
    'Tool:',
    JSON.stringify({
      tool: tool.tool,
      toolName: tool.toolName,
      state: tool.state,
      result: tool.result
    })
  )
  const toolArgs = tool.args || {}
  const marketName = toolArgs.marketName || 'Unknown Market'
  const simulationStatus = useTransactionStatus(tool.state, result)

  // Determine normalized status
  const normalizedStatus =
    tool.state === 'call'
      ? 'pending'
      : result?.status === 'success'
      ? 'confirmed'
      : result?.status === 'fail'
      ? 'failed'
      : null

  // Get appropriate icon and text for current status
  const getStatusInfo = (status: TransactionStatus) => {
    switch (status) {
      case 'preparing':
        return {
          icon: <Clock className="h-4 w-4" />,
          text: 'Preparing zap transaction',
          color: 'text-blue-600 dark:text-blue-400'
        }
      case 'building':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: 'Building zap transaction',
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
          text: 'Zap transaction confirmed',
          color: 'text-green-600 dark:text-green-400'
        }
      case 'failed':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Zap transaction failed',
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
    const finalStatus =
      status === 'confirmed' || status === 'failed' ? status : 'processing'
    switch (finalStatus) {
      case 'processing':
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

  // Progress steps for transaction flow
  const steps = [
    { id: 'preparing', label: 'Preparing' },
    { id: 'building', label: 'Building' },
    { id: 'signing', label: 'Signing' },
    { id: 'broadcasting', label: 'Broadcasting' },
    { id: 'confirming', label: 'Confirming' }
  ]

  // If tool is in pending state, show pending UI with steps
  if (normalizedStatus === 'pending') {
    const statusInfo = getStatusInfo(simulationStatus)
    const currentStepIndex = steps.findIndex(
      step => step.id === simulationStatus
    )

    return (
      <Card className="overflow-hidden rounded-xl border border-blue-600/20 bg-blue-500/10 backdrop-blur-sm dark:bg-sky-950/20 dark:border-sky-400/50">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-blue-600/10 dark:border-sky-400/20">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-300">
                Zapping in to {marketName} LP
              </h3>
              {getStatusBadge(simulationStatus)}
            </div>

            {/* Progress steps */}
            <div className="relative">
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

            {/* Current status */}
            <div
              className={cn(
                'flex items-center text-sm font-medium',
                statusInfo.color
              )}
            >
              {statusInfo.icon}
              <span className="ml-2">{statusInfo.text}</span>
            </div>

            {/* Add status component for consistency */}
            <div className="bg-black/5 dark:bg-black/20 rounded-lg p-3 mt-2">
              <SwapTransactionStatus
                status={simulationStatus}
                chainId={tool.chainId}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If there's an error, show error UI
  if (normalizedStatus === 'failed') {
    return (
      <Card className="overflow-hidden rounded-xl border border-red-600/20 bg-red-500/10 backdrop-blur-sm dark:bg-red-950/20 dark:border-red-400/50">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-red-600/10 dark:border-red-400/20">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-300">
                Zapped in to {marketName} LP
              </h3>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            </div>

            <div className="text-red-600 dark:text-red-400 text-sm font-medium whitespace-pre-wrap break-all">
              {result.error_message || 'Transaction failed'}
            </div>

            {/* Add status component for consistency */}
            <div className="bg-black/5 dark:bg-black/20 rounded-lg p-3">
              <SwapTransactionStatus status="failed" chainId={tool.chainId} />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success UI
  if (normalizedStatus === 'confirmed') {
    return (
      <Card className="overflow-hidden rounded-xl border border-green-600/20 bg-green-500/10 backdrop-blur-sm dark:bg-sky-950/20 dark:border-sky-400/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-green-600/10 dark:border-sky-400/20">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-300">
                Zapped in to {marketName} LP
              </h3>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Confirmed
              </Badge>
            </div>

            {/* Add status component at the top */}
            <div className="bg-black/5 dark:bg-black/20 rounded-lg p-3">
              <SwapTransactionStatus
                status="confirmed"
                txHash={result.hash}
                chainId={tool.chainId}
              />
            </div>

            {/* Transaction Details */}
            <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
              <div className="flex flex-col space-y-3">
                {/* LP Token */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    LP Tokens:
                  </div>
                  <div className="text-sm font-medium">
                    {Number(result.addLiquidityData.amountLpOut).toPrecision(6)} {marketName} LP
                  </div>
                </div>

                {/* YT Token */}
                {result.addLiquidityData.amountYtOut &&
                  result.addLiquidityData.amountYtOut !== '0' && (
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        YT Tokens:
                      </div>
                      <div className="text-sm font-medium">
                        {Number(result.addLiquidityData.amountYtOut).toPrecision(6)} {marketName} YT
                      </div>
                    </div>
                  )}

                {/* Price Impact */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Price Impact:
                  </div>
                  <div className="text-sm font-medium">
                    {(result.addLiquidityData.priceImpact * 100).toFixed(2)}%
                  </div>
                </div>

                {/* Transaction Hash */}
                {result.explorerLink && (
                  <div className="pt-2 mt-2 border-t border-green-600/10 dark:border-sky-400/20">
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Transaction:
                      </div>
                      <a
                        href={result.explorerLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center hover:underline"
                      >
                        {result.hash?.slice(0, 8)}...
                        {result.hash?.slice(-6)}
                        <Link className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Small timestamp note */}
            {result.completeTime && (
              <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
                Transaction completed at{' '}
                {new Date(result.completeTime).toLocaleTimeString([], {
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

  return null
}

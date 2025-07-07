'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { ExternalLink, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTransactionStatus, TransactionStatus } from '@/lib/hooks/use-transaction-status'
import { SwapTransactionStatus } from '../swap-transaction-status'

interface JupiterSwapExecuteProps {
  tool: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function JupiterSwapExecuteSection({
  tool,
  isOpen,
  onOpenChange
}: JupiterSwapExecuteProps) {
  const toolArgs = tool.args || {}
  const simulationStatus = useTransactionStatus(tool.state, tool.result)
  
  // Get status info for swap operations
  const getStatusInfo = (status: TransactionStatus) => {
    switch (status) {
      case 'preparing':
        return {
          icon: <Clock className="h-4 w-4" />,
          text: 'Preparing swap transaction',
          color: 'text-blue-600 dark:text-blue-400'
        }
      case 'building':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: 'Building swap transaction',
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
          icon: <Clock className="h-4 w-4" />,
          text: 'Swap transaction confirmed',
          color: 'text-green-600 dark:text-green-400'
        }
      case 'failed':
        return {
          icon: <Clock className="h-4 w-4" />,
          text: 'Swap transaction failed',
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
            <Clock className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <Clock className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
    }
  }
  
  if (tool.state === 'call') {
    // Progress steps for transaction flow
    const steps = [
      { id: 'preparing', label: 'Preparing' },
      { id: 'building', label: 'Building' },
      { id: 'signing', label: 'Signing' },
      { id: 'broadcasting', label: 'Broadcasting' },
      { id: 'confirming', label: 'Confirming' }
    ]

    const currentStepIndex = steps.findIndex(
      step => step.id === simulationStatus
    )

    const statusInfo = getStatusInfo(simulationStatus)

    return (
      <Card className="overflow-hidden rounded-xl border border-blue-600/20 bg-blue-500/10 backdrop-blur-sm dark:bg-sky-950/20 dark:border-sky-400/50">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-blue-600/10 dark:border-sky-400/20">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-300">
                Swapping {toolArgs.tokenInDisplayName} to {toolArgs.tokenOutDisplayName}
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
            {/* <div className="bg-black/5 dark:bg-black/20 rounded-lg p-3 mt-2">
              <SwapTransactionStatus
                status={simulationStatus}
                chainId={tool.chainId}
              />
            </div> */}
          </div>
                      {/* Amount Display */}
                      <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
              <div className="text-xs tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Swapping
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {toolArgs.amountIn} {toolArgs.tokenInDisplayName}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                to {toolArgs.tokenOutDisplayName}
              </div>
            </div>
        </CardContent>
      </Card>
    )
  }
  if (tool.state !== 'result' || !tool.result) {
    return null
  }

  // Handle new data structure where result data is in the 'data' field
  const toolResult =
    typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
  const result = toolResult.data || toolResult

  // Check if there's an error
  if (result.status === 'Failed' || result.error) {
    return (
      <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-4">
          <div className="text-red-600 dark:text-red-400 font-medium mb-1">
            Swap Failed
          </div>
          <div className="text-sm text-red-600/80 dark:text-red-400/80">
            {result.error || 'Failed to execute swap'}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state
  if (result.status === 'Success' && result.swapDetails) {
    const swapDetails = result.swapDetails
    const amountIn = swapDetails.amountIn || toolArgs.amountIn
    const amountOut = swapDetails.amountOut
    const signature = swapDetails.signature
    const explorerUrl = swapDetails.explorerUrl
    const completeTime = swapDetails.completeTime

    return (
      <Card className="overflow-hidden rounded-xl border border-green-600/20 bg-green-500/10 backdrop-blur-sm dark:bg-green-950/20 dark:border-green-400/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-green-600/10 dark:border-green-400/20">
              <h3 className="text-base font-medium text-gray-800 dark:text-gray-300">
                Swap Executed Successfully
              </h3>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              >
                Complete
              </Badge>
            </div>

            {/* Amount Display */}
            <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
              <div className="text-xs tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                You swapped
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {amountIn} {toolArgs.tokenInDisplayName}
                {swapDetails.amountInUsd && (
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    (≈ ${Number(swapDetails.amountInUsd).toFixed(2)})
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                to {amountOut} {toolArgs.tokenOutDisplayName}
                {swapDetails.amountOutUsd && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    (≈ ${Number(swapDetails.amountOutUsd).toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            {/* Transaction Details */}
            {signature && (
              <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
                <div className="text-xs tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  Transaction Details
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Signature
                    </span>
                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {signature.slice(0, 8)}...{signature.slice(-8)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs font-mono text-gray-800 dark:text-gray-200">
                        {signature.slice(0, 8)}...{signature.slice(-8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
              Completed at{' '}
              {new Date(completeTime || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Fallback for unknown states
  return (
    <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
      <CardContent className="pt-4">
        <div className="text-yellow-600 dark:text-yellow-400 font-medium mb-1">
          Unknown Status
        </div>
        <div className="text-sm text-yellow-600/80 dark:text-yellow-400/80">
          Unable to determine swap status
        </div>
      </CardContent>
    </Card>
  )
}

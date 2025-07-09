'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CHAT_ID } from '@/lib/constants'
import { useChat } from '@ai-sdk/react'
import { faGasPump } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ToolInvocation } from 'ai'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CollapsibleMessage } from '../collapsible-message'
import { DefaultSkeleton } from '../default-skeleton'
import { ToolArgsSection } from '../section'
import { CopyButton } from '../copy-button'

interface JupiterSwapDetails {
  amountOut: string
  networkFee: number
  numMarkets: number
  routeMarketNames: string[]
  routeMarketAddresses: string[]
  tokenOutDecimals: number
  tokenOutAddress: string
  amountIn: number
  tokenInAddress: string
  tokenInDecimals: number
  router: string
  priceImpactPct: number
  amountInUsd: number
  amountOutUsd: number
  completeTime: number
  feeBps: number
}

interface JupiterQuoteData {
  status: string
  swapDetails?: JupiterSwapDetails
  error?: string
}

interface JupiterSwapQuoteSectionProps {
  tool: ToolInvocation
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function JupiterSwapQuoteSection({
  tool,
  isOpen,
  onOpenChange
}: JupiterSwapQuoteSectionProps) {
  console.log('Start rendering jupiter swap quote')
  const { status } = useChat({
    id: CHAT_ID
  })

  const [hasCopiedTokenIn, setHasCopiedTokenIn] = useState(false)
  const [hasCopiedTokenOut, setHasCopiedTokenOut] = useState(false)

  const isLoading = status === 'submitted' || status === 'streaming'
  const isToolLoading = tool.state === 'call'

  const { open } = useArtifact()

  const toolResult = tool.state === 'result' ? tool.result : null
  const quoteData: JupiterQuoteData | null = toolResult ? toolResult : null
  const instruction = toolResult?.instruction as string | undefined
  const headerLoadingText = 'Fetching Jupiter quote:'
  const headerFailText = 'Failed to fetch quote:'
  const headerFinishText = 'Jupiter quote:'
  const header = (text: string) => (
    <button
      type="button"
      onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection tool="jupiter-quote">{`${text} ${tool.args.amountIn} ${tool.args.tokenInDisplayName} to ${tool.args.tokenOutDisplayName}`}</ToolArgsSection>
    </button>
  )

  const onCopyTokenIn = () => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      quoteData?.swapDetails?.tokenInAddress
    ) {
      navigator.clipboard.writeText(quoteData.swapDetails.tokenInAddress)
      setHasCopiedTokenIn(true)
    }
  }

  useEffect(() => {
    if (hasCopiedTokenIn) {
      const timer = setTimeout(() => {
        setHasCopiedTokenIn(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [hasCopiedTokenIn])

  const onCopyTokenOut = () => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      quoteData?.swapDetails?.tokenOutAddress
    ) {
      navigator.clipboard.writeText(quoteData.swapDetails.tokenOutAddress)
      setHasCopiedTokenOut(true)
    }
  }

  useEffect(() => {
    if (hasCopiedTokenOut) {
      const timer = setTimeout(() => {
        setHasCopiedTokenOut(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [hasCopiedTokenOut])

  if (isLoading && isToolLoading) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header(headerLoadingText)}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <DefaultSkeleton />
      </CollapsibleMessage>
    )
  }

  if (!quoteData && !(isLoading && isToolLoading)) {
    console.log('No quote data')
    return null
  }

  if (instruction && instruction.startsWith('clarify')) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header(headerFailText)}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800 w-full">
          <CardContent className="pt-4">
            <div className="text-sm text-yellow-600/80 dark:text-yellow-400/80 whitespace-pre-wrap break-all">
              {quoteData?.error || 'Failed to get quote'}
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  const isError =
    (instruction &&
      (instruction.includes('error') || instruction.includes('fail'))) ||
    quoteData?.status === 'Failed' ||
    quoteData?.error

  if (isError) {
    const errorMessage =
      quoteData?.error || 'Failed to get quote. Please check the details.'
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header(headerFailText)}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800 w-full">
          <CardContent className="pt-4">
            <div className="text-red-600 dark:text-red-400 font-medium mb-1">
              Error: Could not retrieve Jupiter Swap Quote
            </div>
            <div className="text-sm text-red-600/80 dark:text-red-400/80 whitespace-pre-wrap break-all">
              {errorMessage}
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  if (!quoteData?.swapDetails) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header(headerFinishText)}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800 w-full">
          <CardContent className="pt-4">
            <div className="text-orange-600 dark:text-orange-400 font-medium mb-1">
              {toolResult?.title}
            </div>
            <div className="text-sm text-orange-600/80 dark:text-orange-400/80 whitespace-pre-wrap">
              No swap details available for the quote.
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  const swapDetails = quoteData.swapDetails

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header(headerFinishText)}
      isOpen={isOpen === undefined ? true : isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <Card className="overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 border border-purple-100 dark:border-purple-900 w-full">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="pb-3 border-b border-purple-100 dark:border-purple-900">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  From: {tool.args.tokenInDisplayName + " "}                 
                  {quoteData?.swapDetails?.tokenInAddress && <CopyButton text={quoteData?.swapDetails?.tokenInAddress} className="h-4 w-4 shrink-0" />}
                </div>

              </div>
              <div className="text-lg font-bold text-purple-800 dark:text-purple-300">
                {swapDetails.amountIn} {tool.args.tokenInDisplayName}
              </div>
              {swapDetails.amountInUsd && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ≈ ${swapDetails.amountInUsd.toFixed(2)}
                </div>
              )}
            </div>

            <div className="pb-3 border-b border-purple-100 dark:border-purple-900">
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                To: {tool.args.tokenOutDisplayName + " "}
                {quoteData?.swapDetails?.tokenOutAddress && <CopyButton text={quoteData?.swapDetails?.tokenOutAddress} className="h-4 w-4 shrink-0" />}
              </div>
              <div className="text-lg font-bold text-green-700 dark:text-green-400">
                {swapDetails.amountOut} {tool.args.tokenOutDisplayName}
              </div>
              {swapDetails.amountOutUsd && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ≈ ${swapDetails.amountOutUsd.toFixed(2)}
                </div>
              )}

              <div className="relative pt-2">
                <div className="flex justify-between items-center gap-8 text-sm">
                  <span className="text-xs text-grey-500 dark:text-grey-400">
                    1 {tool.args.tokenOutDisplayName} ≈{' '}
                    {(
                      swapDetails.amountIn / parseFloat(swapDetails.amountOut)
                    ).toPrecision(2)}{' '}
                    {tool.args.tokenInDisplayName}
                  </span>

                  {swapDetails.networkFee > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      <FontAwesomeIcon
                        icon={faGasPump}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      />{' '}
                      {swapDetails.networkFee} SOL
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4">
              <div className="flex flex-col gap-2 text-xs">
                {/* Price Impact */}
                <div className="flex items-center gap-2">
                  <div className="text-gray-600 dark:text-gray-300 min-w-[90px] flex items-center gap-1">
                    Price Impact
                  </div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    {swapDetails.priceImpactPct.toFixed(4)}%
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-gray-600 dark:text-gray-300 min-w-[90px] flex items-center gap-1">
                    Fee
                  </div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    {swapDetails.feeBps || 0}%
                  </div>
                </div>

                {/* Router */}
                <div className="flex items-center gap-2">
                  <div className="text-gray-600 dark:text-gray-300 min-w-[90px] flex items-center gap-1">
                    Router
                  </div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    {swapDetails.router}
                  </div>
                </div>
                {/* Route (Markets) */}
                <div className="flex items-center gap-2">
                  <div className="text-gray-600 dark:text-gray-300 min-w-[90px] flex items-center gap-1">
                    {/* Link icon for route */}
                    Route ({swapDetails.numMarkets}{' '}
                    {swapDetails.numMarkets > 1 ? 'markets' : 'market'})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {swapDetails.routeMarketNames.map((market, idx) => (
                      <a
                        key={market + idx}
                        href={`https://solscan.io/account/${swapDetails.routeMarketAddresses[idx]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <Badge
                          variant="outline"
                          className="border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white/60 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
                        >
                          {market}
                        </Badge>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
              Quote valid as of{' '}
              {new Date(
                swapDetails.completeTime || Date.now()
              ).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </CollapsibleMessage>
  )
}

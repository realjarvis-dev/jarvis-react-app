'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { Card, CardContent } from '@/components/ui/card'
import { CHAT_ID } from '@/lib/constants'
import { useChat } from '@ai-sdk/react'
import { ToolInvocation } from 'ai'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { ToolArgsSection } from './section'

// Based on readableQuote from lifi-bridge.ts
interface LifiQuoteData {
  fromChain: string
  fromToken: string
  fromAmountToken: string
  toChain: string // Added based on usage
  toToken: string // Added based on usage
  toAmountToken: string
  fromAmountUSD?: string
  toAmountUSD?: string
  gasCostsUSD?: number
  otherFeeDetails?: Array<{ name: string; amountUSD: string }>
  complete_time?: string | number // Assuming it might exist for timestamp
  // Potentially, if an error string is passed directly in details
  error?: string
}

interface LifiSwapQuoteSectionProps {
  tool: ToolInvocation
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function LifiSwapQuoteSection({
  tool,
  isOpen,
  onOpenChange
}: LifiSwapQuoteSectionProps) {
  const { status } = useChat({
    id: CHAT_ID
  })
  const isLoading = status === 'submitted' || status === 'streaming'
  const isToolLoading = tool.state === 'call'

  const { open } = useArtifact()

  const toolResult = tool.state === 'result' ? tool.result : null
  const quoteData: LifiQuoteData | string | null = toolResult?.details
    ? toolResult.details
    : null
  const instruction = toolResult?.instruction as string | undefined

  const header = (
    <button
      type="button"
      onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection
        tool="lifi-swap-quote"
        // Displaying from/to tokens and chains from arguments if available
      >{`LI.FI Quote: ${tool.args.fromToken} (${tool.args.fromChain}) to ${tool.args.toToken} (${tool.args.toChain})`}</ToolArgsSection>
    </button>
  )

  if (isLoading && isToolLoading) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <DefaultSkeleton />
      </CollapsibleMessage>
    )
  }

  if (!quoteData && !(isLoading && isToolLoading)) {
    // If there's no quote data and we are not in a loading state, render nothing or a specific message
    // For now, returning null if there are no details to show.
    return null
  }

  // Handle clarification messages from the tool
  if (instruction && instruction.startsWith('clarify')) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
          <CardContent className="pt-4">
            <div className="text-yellow-600 dark:text-yellow-400 font-medium mb-1">
              {instruction
                .replace(/^clarify (the )?/, '')
                .replace(/ with user$/, '')
                .split(' ')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')}
            </div>
            <div className="text-sm text-yellow-600/80 dark:text-yellow-400/80">
              {typeof quoteData === 'string'
                ? quoteData
                : JSON.stringify(quoteData)}
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  // Handle error messages. Errors can be indicated by instruction or if quoteData is a string (error message).
  const isError =
    (instruction &&
      (instruction.includes('error') || instruction.includes('fail'))) ||
    (typeof quoteData === 'string' &&
      instruction !== 'clarify the input and output with user' &&
      instruction !== 'clarify the input token with user' &&
      instruction !== 'clarify the output token with user')
  if (isError) {
    const errorMessage =
      typeof quoteData === 'string'
        ? quoteData
        : 'Failed to get quote. Please check the details.'
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="text-red-600 dark:text-red-400 font-medium mb-1">
              Error: Could not retrieve LI.FI Swap Quote
            </div>
            <div className="text-sm text-red-600/80 dark:text-red-400/80">
              {errorMessage}
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  // If quoteData is a string here, it implies it might be an unhandled case or an error string not caught above.
  // For safety, we should not proceed if it's not the expected object structure.
  if (typeof quoteData === 'string' || !quoteData) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen === undefined ? true : isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800">
          <CardContent className="pt-4">
            <div className="text-orange-600 dark:text-orange-400 font-medium mb-1">
              Information
            </div>
            <div className="text-sm text-orange-600/80 dark:text-orange-400/80">
              {quoteData || 'No details available for the quote.'}
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  const displayData = quoteData as LifiQuoteData

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen === undefined ? true : isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-900">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* From Section */}
            <div className="pb-3 border-b border-blue-100 dark:border-blue-900">
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                From: {displayData.fromChain} ({displayData.fromToken})
              </div>
              <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
                {displayData.fromAmountToken} {displayData.fromToken}
              </div>
              {displayData.fromAmountUSD && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ≈ ${parseFloat(displayData.fromAmountUSD).toFixed(2)}
                </div>
              )}
            </div>

            {/* To Section */}
            <div className="pb-3 border-b border-blue-100 dark:border-blue-900">
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                To: {displayData.toChain || 'Unknown Chain'} (
                {displayData.toToken || 'Unknown Token'})
              </div>
              <div className="text-lg font-bold text-green-700 dark:text-green-400">
                {displayData.toAmountToken}{' '}
                {displayData.toToken || 'Unknown Token'}
              </div>
              {displayData.toAmountUSD && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ≈ ${parseFloat(displayData.toAmountUSD).toFixed(2)}
                </div>
              )}
            </div>

            {/* Fees Section */}
            {(displayData.gasCostsUSD !== undefined ||
              (displayData.otherFeeDetails &&
                displayData.otherFeeDetails.length > 0)) && (
              <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                  Estimated Fees
                </div>
                {displayData.gasCostsUSD !== undefined && (
                  <div className="flex justify-between text-xs mb-1">
                    <div className="text-gray-600 dark:text-gray-300">
                      Gas Cost:
                    </div>
                    <div className="text-gray-800 dark:text-gray-100">
                      ${parseFloat(String(displayData.gasCostsUSD)).toFixed(2)}
                    </div>
                  </div>
                )}
                {displayData.otherFeeDetails &&
                  displayData.otherFeeDetails.map(
                    (
                      fee: { name: string; amountUSD: string },
                      index: number
                    ) => (
                      <div
                        key={index}
                        className="flex justify-between text-xs mb-1"
                      >
                        <div className="text-gray-600 dark:text-gray-300">
                          {fee.name}:
                        </div>
                        <div className="text-gray-800 dark:text-gray-100">
                          ${parseFloat(fee.amountUSD).toFixed(2)}
                        </div>
                      </div>
                    )
                  )}
              </div>
            )}

            {/* Small timestamp note */}
            {displayData.complete_time && (
              <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
                Quote valid as of{' '}
                {new Date(displayData.complete_time).toLocaleTimeString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </CollapsibleMessage>
  )
}

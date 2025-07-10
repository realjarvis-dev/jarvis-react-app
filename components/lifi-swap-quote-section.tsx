'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { Card, CardContent } from '@/components/ui/card'
import { CHAT_ID } from '@/lib/constants'
import { useChat } from '@ai-sdk/react'
import { faGasPump } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ToolInvocation } from 'ai'
import { useState } from 'react'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { ToolArgsSection } from './section'

// Based on readableQuote from lifi-bridge.ts
interface FeeItem {
  name: string
  symbol: string
  chainName: string
  amount: string
  amountUSD: string
}

interface GasCostItem {
  type: string
  symbol: string
  chainName: string
  amount: string
  amountUSD: string
}

interface LifiQuoteData {
  fromChain: string
  fromToken: string
  fromAmountToken: string
  toChain: string
  toToken: string
  toAmountToken: string
  fromAmountUSD?: string
  toAmountUSD?: string
  gasCosts?: GasCostItem[]
  gasCostsUSD?: number // Total gas cost in USD
  otherFeeUSD?: number // Total other fee cost in USD
  otherFeeDetails?: FeeItem[]
  byProductAmount?: string
  byProductAmountMinusGas?: string
  byProductAmountUSD?: number
  byProductAmountMinusGasUSD?: number
  byProductSymbol?: string
  complete_time: string // ISO string
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
  const [showFeeDetails, setShowFeeDetails] = useState(false)

  const isLoading = status === 'submitted' || status === 'streaming'
  const isToolLoading = tool.state === 'call'

  const { open } = useArtifact()

  const toolResult = tool.state === 'result' ? tool.result : null
  const quoteData: LifiQuoteData | string | null = toolResult?.details
    ? toolResult.details
    : null
  const instruction = toolResult?.instruction as string | undefined
  const headerLoadingText = 'Fetching best Li.Fi quote:'
  const headerFailText = 'Fail to fetch quote:'
  const headerFinishText = 'Li.Fi quote:'
  const header = (text: string) => (
    <button
      type="button"
      onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection tool="lifi-swap-quote">{`${text} ${tool.args.amountIn} ${tool.args.fromToken} (${tool.args.fromChain}) to ${tool.args.toToken} (${tool.args.toChain})`}</ToolArgsSection>
    </button>
  )

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
              {typeof quoteData === 'string'
                ? quoteData
                : JSON.stringify(quoteData, null, 2)}
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  const isError =
    (instruction &&
      (instruction.includes('error') || instruction.includes('fail'))) ||
    (typeof quoteData === 'string' && quoteData.includes('error'))
  if (isError) {
    const errorMessage =
      typeof quoteData === 'string'
        ? quoteData
        : 'Failed to get quote. Please check the details.'
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
             Hmm… we’re unable to pull your Li.Fi swap quote at the moment.
            </div>
            <div className="text-sm text-red-600/80 dark:text-red-400/80 whitespace-pre-wrap break-all">
              {errorMessage}
            </div>
          </CardContent>
        </Card>
      </CollapsibleMessage>
    )
  }

  if (typeof quoteData === 'string' || !quoteData) {
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
      header={header(headerFinishText)}
      isOpen={isOpen === undefined ? true : isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-900 w-full">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
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

            <div className="pb-3 border-b border-blue-100 dark:border-blue-900">
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
                To: {displayData.toChain} ({displayData.toToken})
              </div>
              <div className="text-lg font-bold text-green-700 dark:text-green-400">
                {displayData.toAmountToken} {displayData.toToken}
              </div>
              {displayData.toAmountUSD && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ≈ ${parseFloat(displayData.toAmountUSD).toFixed(2)}
                </div>
              )}
              {(displayData.gasCostsUSD !== undefined ||
                displayData.otherFeeUSD !== undefined) && (
                <div className="relative pt-2">
                  <div className="flex justify-between items-center gap-8 text-sm">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      1 {displayData.toToken} ≈{' '}
                      {(
                        parseFloat(displayData.fromAmountToken || '0') /
                        parseFloat(displayData.toAmountToken || '1')
                      ).toPrecision(2)}{' '}
                      {displayData.fromToken}
                    </span>

                    <span
                      className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer"
                      onMouseEnter={() => setShowFeeDetails(true)}
                      onMouseLeave={() => setShowFeeDetails(false)}
                    >
                      <FontAwesomeIcon
                        icon={faGasPump}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      />{' '}
                      $
                      {parseFloat(
                        String(
                          (displayData.gasCostsUSD || 0) +
                            (displayData.otherFeeUSD || 0)
                        )
                      ).toPrecision(2)}
                    </span>
                  </div>

                  {showFeeDetails && (
                    <div className="absolute bottom-full right-0 mb-1 z-20 w-full md:w-auto md:min-w-[380px] p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl">
                      {/* Total Gas */}
                      {displayData.gasCostsUSD !== undefined && (
                        <div className="flex justify-between text-xs mb-1 font-semibold">
                          <div className="text-gray-800 dark:text-gray-100">
                            Network Fee:
                          </div>
                          <div className="text-gray-800 dark:text-gray-100">
                            ~$
                            {parseFloat(
                              String(displayData.gasCostsUSD)
                            ).toPrecision(2)}
                          </div>
                        </div>
                      )}
                      {/* Detailed Gas */}
                      {displayData.gasCosts &&
                        displayData.gasCosts.map(
                          (gas: GasCostItem, index: number) => (
                            <div
                              key={`gas-${index}`}
                              className="flex justify-between text-xs ml-2 mb-0.5"
                            >
                              <div className="text-gray-600 dark:text-gray-300">
                                ↳ {gas.type} ({gas.symbol} on {gas.chainName}):
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {parseFloat(gas.amount).toPrecision(4)}{' '}
                                {gas.symbol} (~$
                                {parseFloat(gas.amountUSD).toPrecision(2)})
                              </div>
                            </div>
                          )
                        )}

                      {/* Separator if both gas and other fees are present */}
                      {(displayData.gasCostsUSD !== undefined ||
                        (displayData.gasCosts &&
                          displayData.gasCosts.length > 0)) &&
                        (displayData.otherFeeUSD !== undefined ||
                          (displayData.otherFeeDetails &&
                            displayData.otherFeeDetails.length > 0)) && (
                          <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800"></div>
                        )}

                      {/* Total Other Fees */}
                      {displayData.otherFeeUSD !== undefined && (
                        <div className="flex justify-between text-xs mb-1 mt-1 font-semibold">
                          <div className="text-gray-800 dark:text-gray-100">
                            Provider Fee:
                          </div>
                          <div className="text-gray-800 dark:text-gray-100">
                            ~$
                            {parseFloat(
                              String(displayData.otherFeeUSD)
                            ).toPrecision(2)}
                          </div>
                        </div>
                      )}

                      {/* Detailed Other Fees */}
                      {displayData.otherFeeDetails &&
                        displayData.otherFeeDetails.map(
                          (fee: FeeItem, index: number) => (
                            <div
                              key={`other-${index}`}
                              className="flex justify-between text-xs ml-2 mb-0.5"
                            >
                              <div className="text-gray-600 dark:text-gray-300">
                                ↳ {fee.name}:
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {/* {parseFloat(fee.amount).toPrecision(4)}{' '} */}
                                ~${parseFloat(fee.amountUSD).toPrecision(2)}
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto-fueled Token Section */}
            {(displayData.byProductAmount ||
              displayData.byProductAmountUSD) && (
              <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-4">
                <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                  Auto-fueled Native Token on {displayData.toChain}:
                </div>
                {displayData.byProductAmount && (
                  <div className="flex justify-between text-xs mb-1">
                    <div className="text-gray-800 dark:text-gray-100">
                      Amount Fueled:
                    </div>
                    <div className="text-gray-800 dark:text-gray-100">
                      {Number(displayData.byProductAmount).toPrecision(4)}{' '}
                      {displayData.byProductSymbol}
                      {displayData.byProductAmountUSD !== undefined &&
                        `(~$${parseFloat(
                          String(displayData.byProductAmountUSD)
                        ).toFixed(2)})`}
                    </div>
                  </div>
                )}
                {displayData.byProductAmountMinusGas && (
                  <div className="flex justify-between text-xs mb-1">
                    <div className="text-gray-600 dark:text-gray-300">
                      ↳ After this transaction:
                    </div>
                    <div className="text-gray-700 dark:text-gray-200">
                      {Number(displayData.byProductAmountMinusGas).toPrecision(
                        4
                      )}{' '}
                      {displayData.byProductSymbol}
                      {displayData.byProductAmountMinusGasUSD !== undefined &&
                        ` (~$${parseFloat(
                          String(displayData.byProductAmountMinusGasUSD)
                        ).toFixed(2)})`}
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  This amount was automatically swapped to the native token of
                  the destination chain to cover future transaction fees.
                </div>
              </div>
            )}

          {tool.args.preference && (
              <div className="text-xs text-grey-500 dark:text-grey-400">
                Route preference: {tool.args.preference.toLowerCase()}
              </div>
            )}

            {displayData.complete_time && (
              <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
                Quote valid as of{' '}
                {new Date(displayData.complete_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </CollapsibleMessage>
  )
}

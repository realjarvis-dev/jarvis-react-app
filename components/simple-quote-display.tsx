'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface SimpleQuoteDisplayProps {
  tool: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SimpleQuoteDisplay({
  tool,
  isOpen,
  onOpenChange
}: SimpleQuoteDisplayProps) {
  if (tool.state !== 'result' || !tool.result) {
    return null
  }

  // Handle new data structure where quote data is in the 'data' field
  const toolResult =
    typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
  const result = toolResult.data || toolResult

  // Check if there's an error
  if (result.error) {
    return (
      <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-4">
          <div className="text-red-600 dark:text-red-400 font-medium mb-1">
           Whoops—we couldn&apos;t get your quote just now.
          </div>
          <div className="text-sm text-red-600/80 dark:text-red-400/80">
            {result.error}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Extract input and output tokens from result
  const inputToken = result.inputToken || 'ETH'
  const outputToken = result.outputToken || result.market || 'Unknown Token'

  const outputVal = result.outputAmount || result.output_amount
  const num = Number(outputVal)
  const displayAmount = outputVal
    ? isNaN(num)
      ? outputVal
      : num.toPrecision(4)
    : '?'

  // Display the quote result with an improved UI
  return (
    <Card className="overflow-hidden rounded-xl border border-blue-600/20 bg-blue-500/10 backdrop-blur-sm dark:bg-sky-950/20 dark:border-sky-400/50">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-blue-600/10 dark:border-sky-400/20">
            <h3 className="text-base font-medium text-gray-800 dark:text-gray-300">
              Quote
            </h3>
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
            >
              {result.market || outputToken}
            </Badge>
          </div>

          {/* Main Conversion Display */}
          <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
            <div className="text-xs tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              For {result.inputAmount || 1} {inputToken} you receive
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {displayAmount} {outputToken}
            </div>
          </div>

          {/* Exchange Rate Details */}
          <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
            <div className="flex justify-between">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Exchange Rate
              </div>
              <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
                {result.rate || `1 ${inputToken} = ? ${outputToken}`}
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Inverse Rate</span>
              <span>
                {result.inverse || `1 ${outputToken} = ? ${inputToken}`}
              </span>
            </div>
          </div>

          {/* Small timestamp note */}
          <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            Quote valid as of{' '}
            {new Date(result.complete_time || Date.now()).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

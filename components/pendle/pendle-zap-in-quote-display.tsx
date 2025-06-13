'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface PendleQuoteDisplayProps {
  tool: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PendleZapInQuoteDisplay({
  tool,
  isOpen,
  onOpenChange
}: PendleQuoteDisplayProps) {
  if (tool.state !== 'result' || !tool.result) {
    return null
  }

  // Handle new data structure where quote data is in the 'data' field
  const toolResult =
    typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
  const result = toolResult.data || toolResult
  const toolArgs = tool.args || {}
  if (tool.state === 'call') {
    // show a skeleton
    return (
      <Card className="overflow-hidden rounded-xl border border-blue-600/20 bg-blue-500/10 backdrop-blur-sm dark:bg-sky-950/20 dark:border-sky-400/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
              <div className="text-xs tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Fetching quote...
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  // Check if there's an error
  if (result.error_message) {
    return (
      <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-4">
          <div className="text-red-600 dark:text-red-400 font-medium mb-1">
            Error: Failed to get quote
          </div>
          <div className="text-sm text-red-600/80 dark:text-red-400/80">
            {result.error_message}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Extract input token and amounts
  const inputToken = toolArgs.tokenInName || 'Unknown Token'
  const inputAmount = toolArgs.amountIn || '0'
  const lpAmount = Number(result.quote?.amountLpOut).toPrecision(6) || 0
  const ytAmount = Number(result.quote?.amountYtOut).toPrecision(6) || 0
  const priceImpact = result.quote?.priceImpact || 0

  // Display the quote result with an improved UI
  return (
    <Card className="overflow-hidden rounded-xl border border-blue-600/20 bg-blue-500/10 backdrop-blur-sm dark:bg-sky-950/20 dark:border-sky-400/50">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-blue-600/10 dark:border-sky-400/20">
            <h3 className="text-base font-medium text-gray-800 dark:text-gray-300">
              Pendle Zap In Quote
            </h3>
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
            >
              {toolArgs.marketName || 'Unknown Market'}
            </Badge>
          </div>

          {/* Input Amount */}
          <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
            <div className="text-xs tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Input Amount
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {inputAmount} {inputToken}
            </div>
          </div>

          {/* Output Amounts */}
          <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
            <div className="text-xs tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              You will receive
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  LP Tokens
                </span>
                <span className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                  {lpAmount} LP
                </span>
              </div>
              {Number(ytAmount) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    YT Tokens
                  </span>
                  <span className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                    {ytAmount} YT
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Price Impact */}
          <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Price Impact
              </span>
              <span
                className={`text-sm font-semibold ${
                  priceImpact > 1
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              >
                {priceImpact.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Small timestamp note */}
          <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            Quote valid as of{' '}
            {new Date(result.completeTime || Date.now()).toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit'
              }
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { ToolArgsSection } from './section'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { CheckCircle, AlertTriangle, Clock, TrendingUp, Shield, DollarSign } from 'lucide-react'

interface PendlePtLoopingExecutionCardProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function PendlePtLoopingExecutionCard({
  tool,
  isOpen,
  onOpenChange
}: PendlePtLoopingExecutionCardProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  const toolResult = tool.result || {}
  const result = toolResult.data || toolResult || {}

  const header = (
    <ToolArgsSection tool="pendle_pt_looping_execute">
      PT Looping Execution
    </ToolArgsSection>
  )

  if (result.error) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="p-4 text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2 font-medium mb-2">
            <AlertTriangle size={16} />
            Execution Failed
          </div>
          <div className="text-sm">{result.error}</div>
          {result.maxSafeLeverage && (
            <div className="mt-2 text-sm">
              <strong>Suggestion:</strong> Try a lower leverage (max safe: {result.maxSafeLeverage}x)
            </div>
          )}
        </div>
      </CollapsibleMessage>
    )
  }

  const strategy = result.strategy || result.plannedStrategy

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <div className="space-y-4 p-4">
        {/* Demo Mode Warning */}
        {result.demoMode && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Clock size={16} />
              <span className="font-medium">Demo Mode</span>
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              {result.warning || 'This is a simulation. No real transactions will be executed.'}
            </div>
          </div>
        )}

        {/* Execution Status */}
        {!result.demoMode && result.message && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <Clock size={16} />
              <span className="font-medium">Development Notice</span>
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              {result.message}
            </div>
          </div>
        )}

        {/* Strategy Overview */}
        {strategy && (
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={18} />
                Looping Strategy Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Token Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-gray-600 dark:text-gray-400">PT Token</div>
                  <div className="font-medium">{strategy.ptToken}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Loan Asset</div>
                  <div className="font-medium">{strategy.loanAsset || 'USDC'}</div>
                </div>
              </div>

              {/* Financial Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Initial Amount</div>
                  <div className="font-medium text-green-600 dark:text-green-400">
                    ${strategy.initialAmount.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Target Leverage</div>
                  <div className="font-medium">{strategy.targetLeverage}x</div>
                </div>
              </div>

              {/* Position Details */}
              {strategy.totalCollateralValue && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Collateral</div>
                    <div className="font-medium">
                      ${strategy.totalCollateralValue.toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Borrowed</div>
                    <div className="font-medium">
                      ${strategy.totalBorrowValue.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Health Factor */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={16} />
                    <span className="text-sm font-medium">Health Factor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">
                      {strategy.expectedHealthFactor?.toFixed(2) || 'N/A'}
                    </span>
                    {strategy.expectedHealthFactor && (
                      <Badge 
                        className={
                          strategy.expectedHealthFactor >= 2 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : strategy.expectedHealthFactor >= 1.5
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }
                      >
                        {strategy.expectedHealthFactor >= 2 ? 'Safe' : 
                         strategy.expectedHealthFactor >= 1.5 ? 'Moderate' : 'Risky'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Expected Returns */}
              {strategy.estimatedApy && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      <span className="text-sm font-medium">Estimated APY</span>
                    </div>
                    <span className="font-bold text-xl text-green-600 dark:text-green-400">
                      {strategy.estimatedApy.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Loop Information */}
              {strategy.numberOfLoops && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Execution Plan:</strong> {strategy.numberOfLoops} loops required to reach target leverage
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Risk Warnings */}
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-red-600 dark:text-red-400 mt-0.5" size={16} />
            <div className="text-sm text-red-800 dark:text-red-200">
              <div className="font-medium mb-2">⚠️ Important Risk Considerations</div>
              <div className="space-y-1 text-xs">
                <div>• <strong>Liquidation Risk:</strong> If health factor drops below 1.0, your position may be liquidated</div>
                <div>• <strong>Interest Rate Risk:</strong> Rising borrow rates can reduce profitability</div>
                <div>• <strong>Smart Contract Risk:</strong> Both Pendle and Morpho protocols carry inherent risks</div>
                <div>• <strong>Market Risk:</strong> PT token prices and yields can be volatile</div>
                <div>• <strong>Complexity:</strong> Multi-step transactions may fail partially, requiring manual intervention</div>
              </div>
            </div>
          </div>
        </div>

        {/* Implementation Notice */}
        {!result.demoMode && (
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Full execution implementation is in development. Use demo mode to preview strategies.
            </div>
          </div>
        )}
      </div>
    </CollapsibleMessage>
  )
}
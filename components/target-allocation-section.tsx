'use client'

import { ToolInvocation } from 'ai'
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, XCircle } from 'lucide-react'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface TargetAllocationSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function TargetAllocationSection({
  tool,
  isOpen,
  onOpenChange
}: TargetAllocationSectionProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  if (tool.state !== 'result' || !tool.result) {
    return <DefaultSkeleton />
  }

  const toolResult = typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
  const result = toolResult.data || toolResult || {}
  const allocation = result.allocation || result.targetAllocation || tool.args?.allocation || {}
  const isGetTool = tool.toolName === 'get_target_allocation'
  
  // Enhanced data for portfolio analysis
  const actualAllocation = result.actualAllocation || {}
  const drift = result.drift || {}
  const totalUsdValue = result.totalUsdValue || 0
  const analysis = result.analysis || {}

  const header = (
    <ToolArgsSection tool="target-allocation">
      {isGetTool ? 'Portfolio Allocation Analysis' : 'Target Portfolio Allocation'}
    </ToolArgsSection>
  )

  if (result.error || toolResult.error) {
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
            <XCircle size={18} />
            {isGetTool ? 'No Target Allocation Found' : 'Error Creating Target Allocation'}
          </div>
          <div className="text-sm">{result.error || toolResult.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <Section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle size={20} />
              {isGetTool ? 'Portfolio Analysis Complete' : 'Target Allocation Created Successfully'}
            </CardTitle>
            <CardDescription>
              {isGetTool 
                ? `Total portfolio value: $${totalUsdValue.toFixed(2)}`
                : 'Your portfolio allocation strategy has been saved and can be used for rebalancing.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Target Allocation */}
              <div>
                <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  Target Allocation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.entries(allocation).map(([token, percentage]) => (
                    <div key={token} className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {String(percentage)}%
                      </div>
                      <Badge variant="secondary" className="mt-1">
                        {token}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actual Allocation & Drift Analysis (only for get tool) */}
              {isGetTool && Object.keys(actualAllocation).length > 0 && (
                <>
                  <div>
                    <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground mb-3">
                      Current Allocation
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {Object.entries(actualAllocation).map(([token, percentage]) => {
                        const targetPercentage = allocation[token] || 0
                        const driftValue = drift[token] || 0
                        const isOverweight = driftValue > 5
                        const isUnderweight = driftValue < -5
                        const isOnTarget = Math.abs(driftValue) <= 5
                        
                        return (
                          <div key={token} className="flex flex-col items-center p-3 bg-muted/50 rounded-lg relative">
                            <div className="text-2xl font-bold text-primary">
                              {(percentage as number).toFixed(1)}%
                            </div>
                            <Badge variant="secondary" className="mt-1 mb-2">
                              {token}
                            </Badge>
                            
                            {/* Drift indicator */}
                            <div className="flex items-center gap-1 text-xs">
                              {isOverweight && (
                                <>
                                  <TrendingUp size={12} className="text-orange-500" />
                                  <span className="text-orange-600 dark:text-orange-400">
                                    +{driftValue.toFixed(1)}%
                                  </span>
                                </>
                              )}
                              {isUnderweight && (
                                <>
                                  <TrendingDown size={12} className="text-red-500" />
                                  <span className="text-red-600 dark:text-red-400">
                                    {driftValue.toFixed(1)}%
                                  </span>
                                </>
                              )}
                              {isOnTarget && (
                                <span className="text-green-600 dark:text-green-400">
                                  On target
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Rebalancing Recommendation */}
                  {analysis.needsRebalancing && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                        <AlertTriangle size={16} />
                        Rebalancing Recommended
                      </div>
                      <p className="text-amber-600 dark:text-amber-400 text-sm">
                        Your portfolio has drifted more than 5% from your target allocation. 
                        Consider rebalancing to get back on track.
                      </p>
                      <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        Maximum drift: {analysis.maxDrift?.toFixed(1)}%
                      </div>
                    </div>
                  )}

                  {!analysis.needsRebalancing && analysis.hasSignificantDrift !== undefined && (
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
                        <CheckCircle size={16} />
                        Portfolio On Track
                      </div>
                      <p className="text-green-600 dark:text-green-400 text-sm">
                        Your portfolio allocation is within acceptable drift limits. No rebalancing needed at this time.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </Section>
    </CollapsibleMessage>
  )
} 
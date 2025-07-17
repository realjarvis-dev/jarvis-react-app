'use client'

import { ToolInvocation } from 'ai'
import { AlertTriangle, CheckCircle, DollarSign, RefreshCw, XCircle } from 'lucide-react'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface RebalancingExecutionSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function RebalancingExecutionSection({
  tool,
  isOpen,
  onOpenChange
}: RebalancingExecutionSectionProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  if (tool.state !== 'result' || !tool.result) {
    return <DefaultSkeleton />
  }

  const toolResult = typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
  const result = toolResult.data || toolResult || {}
  
  const isDryRun = tool.args?.dry_run || result.isDryRun || false
  const executedActions = result.executedActions || []
  const rebalanceActions = result.rebalanceActions || []
  const errors = result.errors || []
  const totalUsdValue = result.totalUsdValue || 0
  const actualAllocation = result.actualAllocation || {}
  const targetAllocation = result.targetAllocation || {}
  const drift = result.drift || {}

  const header = (
    <ToolArgsSection tool="rebalancing">
      {isDryRun ? 'Rebalancing Plan' : 'Portfolio Rebalancing'}
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
            Rebalancing Failed
          </div>
          <div className="text-sm">{result.error || toolResult.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  // Handle case where no rebalancing is needed
  if (result.rebalanceNeeded === false) {
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
                Portfolio Already Balanced
              </CardTitle>
              <CardDescription>
                Total portfolio value: ${totalUsdValue}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Your portfolio is already well-balanced and within acceptable drift limits. No rebalancing is needed at this time.
                </p>
              </div>
            </CardContent>
          </Card>
        </Section>
      </CollapsibleMessage>
    )
  }

  const hasExecutedActions = executedActions.length > 0
  const hasErrors = errors.length > 0
  const actions = isDryRun ? rebalanceActions : executedActions

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
            <CardTitle className="flex items-center gap-2">
              {isDryRun ? (
                <>
                  <RefreshCw size={20} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-blue-600 dark:text-blue-400">Rebalancing Plan Ready</span>
                </>
              ) : hasExecutedActions ? (
                <>
                  <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400">Rebalancing Complete</span>
                </>
              ) : (
                <>
                  <XCircle size={20} className="text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400">Rebalancing Failed</span>
                </>
              )}
            </CardTitle>
            <CardDescription>
              Total portfolio value: ${totalUsdValue}
              {isDryRun && ' • This is a dry run preview'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Rebalancing Actions */}
              {actions.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground mb-3">
                    {isDryRun ? 'Planned Actions' : 'Executed Swaps'}
                  </h4>
                  <div className="space-y-3">
                    {actions.map((action: any, index: number) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-lg border ${
                          isDryRun 
                            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                            : action.transactionHash 
                              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{action.fromToken}</Badge>
                            <TrendingRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">{action.toToken}</Badge>
                          </div>
                          {!isDryRun && action.transactionHash && (
                            <Badge variant="secondary" className="text-xs">
                              Success
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <DollarSign size={14} />
                            <span>Amount: {parseFloat(action.fromAmount).toFixed(6)} {action.fromToken}</span>
                          </div>
                          {action.reason && (
                            <div className="text-xs text-muted-foreground">
                              {action.reason}
                            </div>
                          )}
                          {!isDryRun && action.transactionHash && (
                            <div className="text-xs font-mono text-muted-foreground">
                              TX: {action.transactionHash.slice(0, 10)}...{action.transactionHash.slice(-8)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {hasErrors && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium mb-2">
                    <AlertTriangle size={16} />
                    Execution Errors
                  </div>
                  <div className="space-y-1">
                    {errors.map((error: string, index: number) => (
                      <div key={index} className="text-red-600 dark:text-red-400 text-sm">
                        • {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}



              {/* Next Steps for Dry Run */}
              {isDryRun && actions.length > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mb-2">
                    <RefreshCw size={16} />
                    Ready to Execute
                  </div>
                  <p className="text-blue-600 dark:text-blue-400 text-sm">
                    Review the planned actions above. If you&apos;re satisfied with the rebalancing plan, 
                    ask me to &quot;Execute the rebalancing&quot; to perform the actual swaps.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Section>
    </CollapsibleMessage>
  )
}

// Helper component for arrow icon
function TrendingRight({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M13 7l5 5-5 5M6 12h12" 
      />
    </svg>
  )
} 
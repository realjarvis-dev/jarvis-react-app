'use client'

import { ToolInvocation } from 'ai'
import { CheckCircle, XCircle } from 'lucide-react'
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
  const allocation = result.allocation || tool.args?.allocation || {}
  const isGetTool = tool.toolName === 'get_target_allocation'

  const header = (
    <ToolArgsSection tool="target-allocation">
      {isGetTool ? 'Current Target Allocation' : 'Target Portfolio Allocation'}
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
              {isGetTool ? 'Target Allocation Retrieved' : 'Target Allocation Created Successfully'}
            </CardTitle>
            <CardDescription>
              {isGetTool 
                ? 'Your current portfolio allocation strategy'
                : 'Your portfolio allocation strategy has been saved and can be used for rebalancing.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
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
          </CardContent>
        </Card>
      </Section>
    </CollapsibleMessage>
  )
} 
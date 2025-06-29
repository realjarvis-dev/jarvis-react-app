'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { DeFiLlamaYieldsTable } from './defillama-yields-table'
import { ToolArgsSection } from './section'

interface DeFiLlamaYieldsSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function DeFiLlamaYieldsSection({ 
  tool, 
  isOpen, 
  onOpenChange 
}: DeFiLlamaYieldsSectionProps) {

  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  // Parse the tool result
  const toolResult = tool.result || {}
  const result = toolResult.data || toolResult || {}
  
  // Extract parameters from tool args
  const chain = tool.args?.chain
  const project = tool.args?.project
  const minApy = tool.args?.minApy
  const stablecoin = tool.args?.stablecoin
  const limit = tool.args?.limit || 20

  const getHeaderText = () => {
    const filters = []
    if (chain) filters.push(chain)
    if (project) filters.push(project)
    if (minApy) filters.push(`>${minApy}% APY`)
    if (stablecoin) filters.push('Stablecoins')
    
    return filters.length > 0 ? `💰 Yield Opportunities • ${filters.join(' • ')}` : '💰 High Yield Opportunities'
  }

  const header = (
    <ToolArgsSection tool="defillama_yields">
      {getHeaderText()}
    </ToolArgsSection>
  )

  // Handle error state
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
          <div className="font-medium mb-2">Error fetching yield data</div>
          <div className="text-sm">{result.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  const yields = result.yields || []
  const statistics = result.statistics || {}
  
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {yields.length === 0 ? (
        <div className="p-4 text-muted-foreground">
          No yield opportunities found matching your criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="px-4 pt-4 pb-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">🎯 Opportunities</span>
                <div className="font-semibold text-lg">{yields.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground">📊 Average APY</span>
                <div className="font-semibold text-lg text-green-600">
                  {statistics.averageApy ? `${statistics.averageApy.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">🚀 Highest APY</span>
                <div className="font-semibold text-lg text-blue-600">
                  {statistics.highestApy ? `${statistics.highestApy.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">🔗 Chains</span>
                <div className="font-semibold text-lg">{statistics.uniqueChains || 0}</div>
              </div>
            </div>
          </div>
          
          {/* Yields Table */}
          <DeFiLlamaYieldsTable yields={yields} />
        </div>
      )}
    </CollapsibleMessage>
  )
}
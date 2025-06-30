'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { DeFiLlamaOpportunitiesTable } from './defillama-opportunities-table'
import { ToolArgsSection } from './section'

interface DeFiLlamaOpportunitiesSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function DeFiLlamaOpportunitiesSection({ 
  tool, 
  isOpen, 
  onOpenChange 
}: DeFiLlamaOpportunitiesSectionProps) {

  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  // Parse the tool result
  const toolResult = tool.result || {}
  const result = toolResult.data || toolResult || {}
  
  // Extract parameters from tool args
  const minTvl = tool.args?.minTvl || 1_000_000
  const minGrowth = tool.args?.minGrowth || 10
  const includeYields = tool.args?.includeYields !== false
  const limit = tool.args?.limit || 15

  const header = (
    <ToolArgsSection tool="defillama_opportunities">
      DeFi Opportunity Hunter • TVL ≥ ${(minTvl / 1_000_000).toFixed(1)}M • Growth ≥ {minGrowth}%
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
          <div className="font-medium mb-2">Error analyzing DeFi opportunities</div>
          <div className="text-sm">{result.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  const opportunities = result.opportunities || []
  const analysis = result.analysis || {}
  
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {opportunities.length === 0 ? (
        <div className="p-4 text-muted-foreground">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">No opportunities found</div>
            <div className="text-sm">
              No protocols found with TVL ≥ ${(minTvl / 1_000_000).toFixed(1)}M and 7d growth ≥ {minGrowth}%
            </div>
            <div className="text-xs mt-2">
              {analysis.totalProtocolsAnalyzed} protocols analyzed
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Analysis Summary */}
          <div className="px-4 pt-4 pb-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Opportunities</span>
                <div className="font-semibold text-lg text-green-600">{opportunities.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Growth</span>
                <div className="font-semibold text-lg text-blue-600">
                  +{analysis.averageGrowth ? analysis.averageGrowth.toFixed(1) : '0'}%
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Total TVL</span>
                <div className="font-semibold text-lg">
                  ${analysis.totalTvl ? (analysis.totalTvl / 1e9).toFixed(2) : '0'}B
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Categories</span>
                <div className="font-semibold text-lg">{analysis.categoriesRepresented || 0}</div>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Money Flow Analysis
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                Found {opportunities.length} protocols with significant capital inflow. 
                These represent {analysis.chainsRepresented} chains where money is actively flowing.
                Follow the money to discover why these protocols are gaining traction!
              </div>
            </div>
          </div>
          
          {/* Opportunities Table */}
          <DeFiLlamaOpportunitiesTable 
            opportunities={opportunities}
            includeYields={includeYields}
          />
        </div>
      )}
    </CollapsibleMessage>
  )
}
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
  const includeProtocolAnalysis = tool.args?.includeProtocolAnalysis || false

  const getHeaderText = () => {
    const filters = []
    if (chain) filters.push(chain)
    if (project) filters.push(project)
    if (minApy) filters.push(`>${minApy}% APY`)
    if (stablecoin) filters.push('Stablecoins')
    
    // Use contextual information from statistics to determine appropriate header
    const statistics = result.statistics || {}
    const isProtocolSpecific = statistics.isProtocolSpecific
    const hasHighYieldPools = statistics.hasHighYieldPools
    const highYieldThreshold = statistics.highYieldThreshold || 8
    
    if (filters.length > 0) {
      return `Yield Opportunities • ${filters.join(' • ')}`
    } else if (isProtocolSpecific) {
      return hasHighYieldPools ? `Yield Opportunities (includes high-yield ≥${highYieldThreshold}%)` : 'Yield Opportunities'
    } else {
      return hasHighYieldPools ? 'High Yield Opportunities' : 'Yield Opportunities'
    }
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
  const protocolAnalysis = result.protocolAnalysis || []
  
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
                <span className="text-muted-foreground">Opportunities</span>
                <div className="font-semibold text-lg">{yields.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Average APY</span>
                <div className="font-semibold text-lg text-green-600">
                  {statistics.averageApy ? `${statistics.averageApy.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Highest APY</span>
                <div className="font-semibold text-lg text-blue-600">
                  {statistics.highestApy ? `${statistics.highestApy.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{statistics.isProtocolSpecific ? 'Protocols' : 'Chains'}</span>
                <div className="font-semibold text-lg">{statistics.isProtocolSpecific ? statistics.uniqueProjects || 0 : statistics.uniqueChains || 0}</div>
              </div>
              {statistics.hasHighYieldPools && statistics.highYieldCount > 0 && (
                <div>
                  <span className="text-muted-foreground">High Yield (≥{statistics.highYieldThreshold}%)</span>
                  <div className="font-semibold text-lg text-orange-600">{statistics.highYieldCount}</div>
                </div>
              )}
              {includeProtocolAnalysis && protocolAnalysis.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Protocol Analysis</span>
                  <div className="font-semibold text-lg text-purple-600">{protocolAnalysis.length}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Yields Table with Protocol Analysis */}
          <DeFiLlamaYieldsTable 
            yields={yields} 
            protocolAnalysis={includeProtocolAnalysis ? protocolAnalysis : undefined}
            isProtocolSpecific={statistics.isProtocolSpecific}
            hasHighYieldPools={statistics.hasHighYieldPools}
            searchedProtocol={project}
            highYieldThreshold={statistics.highYieldThreshold}
          />
        </div>
      )}
    </CollapsibleMessage>
  )
}
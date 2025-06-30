'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { DeFiLlamaProtocolsTable } from './defillama-protocols-table'
import { ToolArgsSection } from './section'

interface DeFiLlamaProtocolsSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function DeFiLlamaProtocolsSection({ 
  tool, 
  isOpen, 
  onOpenChange 
}: DeFiLlamaProtocolsSectionProps) {

  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  // Parse the tool result
  const toolResult = tool.result || {}
  const result = toolResult.data || toolResult || {}
  
  // Extract parameters from tool args
  const view = tool.args?.view || 'top_gainers'
  const category = tool.args?.category
  const chain = tool.args?.chain
  const limit = tool.args?.limit || 20

  const getHeaderText = () => {
    switch (view) {
      case 'top_gainers':
        return 'Top 7-Day Gainers'
      case 'top_tvl':
        return 'Top Protocols by TVL'
      case 'custom':
        return 'Custom Protocol Search'
      default:
        return 'DeFi Protocols'
    }
  }

  const getSubtitle = () => {
    const filters = []
    if (category) filters.push(`Category: ${category}`)
    if (chain) filters.push(`Chain: ${chain}`)
    if (filters.length > 0) {
      return ` • ${filters.join(' • ')}`
    }
    return ''
  }

  const header = (
    <ToolArgsSection tool="defillama_protocols">
      {getHeaderText()}{getSubtitle()}
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
          <div className="font-medium mb-2">Error fetching DeFi protocols</div>
          <div className="text-sm">{result.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  const protocols = result.protocols || []
  
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {protocols.length === 0 ? (
        <div className="p-4 text-muted-foreground">
          No protocols found matching your criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{protocols.length} protocols</span>
              {result.totalProtocols && (
                <span>{result.totalProtocols} total available</span>
              )}
              {result.averageTvl && (
                <span>Avg TVL: ${(result.averageTvl / 1e9).toFixed(2)}B</span>
              )}
            </div>
          </div>
          
          {/* Protocols Table */}
          <DeFiLlamaProtocolsTable 
            protocols={protocols} 
            view={view}
          />
        </div>
      )}
    </CollapsibleMessage>
  )
}
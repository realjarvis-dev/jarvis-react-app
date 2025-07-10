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
  const view = result.view || tool.args?.view || 'top_gainers'
  const protocolName = result.searchTerm || tool.args?.protocolName
  const category = tool.args?.category
  const chain = tool.args?.chain
  const limit = tool.args?.limit || 20
  const includeYields = tool.args?.includeYieldOpportunities || false

  const getHeaderText = () => {
    switch (view) {
      case 'protocol_search':
        return protocolName ? `Protocol Search: "${protocolName}"` : 'Protocol Search'
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
    const isSearchError = result.searchTerm && result.error.includes('No protocols found matching')
    
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
          <div className="font-medium mb-2">
            {isSearchError ? 'Hmm, we couldn’t find that protocol—mind trying a different name?' : "Uh-oh, protocols failed to load. Give it another shot?"}
          </div>
          <div className="text-sm">{result.error}</div>
          {isSearchError && (
            <div className="mt-3 text-xs text-muted-foreground">
              Try searching for a different protocol name or check the spelling.
            </div>
          )}
        </div>
      </CollapsibleMessage>
    )
  }

  const protocols = result.protocols || []
  const opportunities = result.opportunities || []
  
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
          <div className="px-2 md:px-4 pt-2 md:pt-4 pb-1 md:pb-2">
            <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
              <span className="whitespace-nowrap">{protocols.length} protocols</span>
              {result.totalProtocols && (
                <span className="whitespace-nowrap">{result.totalProtocols} total available</span>
              )}
              {result.averageTvl && (
                <span className="whitespace-nowrap">Avg TVL: ${(result.averageTvl / 1e9).toFixed(2)}B</span>
              )}
              {includeYields && opportunities.length > 0 && (
                <span className="whitespace-nowrap">{opportunities.length} yield opportunities found</span>
              )}
            </div>
          </div>
          
          {/* Protocols Table */}
          <DeFiLlamaProtocolsTable 
            protocols={protocols} 
            view={view}
            opportunities={includeYields ? opportunities : undefined}
          />
        </div>
      )}
    </CollapsibleMessage>
  )
}
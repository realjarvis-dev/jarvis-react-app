'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { MarketChart } from './market-chart'
import { ToolArgsSection } from './section'

interface MarketChartSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function MarketChartSection({ 
  tool, 
  isOpen, 
  onOpenChange 
}: MarketChartSectionProps) {

  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  // Parse the tool result
  const toolResult = tool.result || {}
  const result = toolResult.data || toolResult || {}
  
  // Extract parameters from tool args
  const coinId = tool.args?.coin_id || 'bitcoin'
  const days = tool.args?.days || 7
  const currency = tool.args?.currency || 'usd'

  const header = (
    <ToolArgsSection tool="market_chart">
      {`${coinId} - ${days} days`}
    </ToolArgsSection>
  )

  // Handle error state
  if (!result.success && result.error) {
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
          <div className="font-medium mb-2">Error fetching market data</div>
          <div className="text-sm">{result.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  // Transform the data to match MarketChart component expectations
  const marketData = result.market_data || []
  
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {marketData.length === 0 ? (
        <div className="p-4 text-muted-foreground">No market data available.</div>
      ) : (
        <MarketChart
          data={marketData}
          coinId={coinId}
          currency={currency.toUpperCase()}
          isLoading={false}
        />
      )}
    </CollapsibleMessage>
  )
} 
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { PendleOpportunitiesTable } from './pendle-opportunities-table'
import { ToolArgsSection } from './section'

interface PendleOpportunitiesSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function PendleOpportunitiesSection({ 
  tool, 
  isOpen, 
  onOpenChange 
}: PendleOpportunitiesSectionProps) {

  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  const header = (
    <ToolArgsSection tool="pendle_opportunities">{`Pendle Opportunities`}</ToolArgsSection>
  )

  const toolResult = tool.result || {}
  const results = toolResult.data || toolResult || []
  
  return (
    <CollapsibleMessage
    role="assistant"
    isCollapsible={true}
    header={header}
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    showIcon={false}
  >
      {results.length === 0 && <div>No opportunities found.</div>}
      <PendleOpportunitiesTable opportunities={results} />
    </CollapsibleMessage>
  )
}
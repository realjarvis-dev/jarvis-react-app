import { OpportunityCard } from './opportunity-card'
import { DefaultSkeleton } from './default-skeleton'
import { ToolArgsSection } from './section'
import { CollapsibleMessage } from './collapsible-message'
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

  const results = tool.result || []
  return (
    <CollapsibleMessage
    role="assistant"
    isCollapsible={true}
    header={header}
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    showIcon={false} // Assuming we want an icon
  >
      {results.length === 0 && <div>No opportunities found.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((opp: any, i: number) => (
          <OpportunityCard key={i} {...opp} />
        ))}
      </div>
    </CollapsibleMessage>
  )
}
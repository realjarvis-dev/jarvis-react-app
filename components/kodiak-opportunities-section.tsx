import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { KodiakOpportunityCard } from './kodiak-opportunity-card'
import { ToolArgsSection } from './section'

interface KodiakOpportunitiesSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function KodiakOpportunitiesSection({ 
  tool, 
  isOpen, 
  onOpenChange 
}: KodiakOpportunitiesSectionProps) {

  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  const header = (
    <ToolArgsSection tool="kodiak_opportunities">{`Kodiak Island Opportunities`}</ToolArgsSection>
  )

  const results = tool.result || []
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {results.length === 0 && <div>No Kodiak Island opportunities found.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((opp: any, i: number) => (
          <KodiakOpportunityCard key={i} {...opp} />
        ))}
      </div>
    </CollapsibleMessage>
  )
} 
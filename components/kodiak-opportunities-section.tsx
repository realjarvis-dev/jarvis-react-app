import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { KodiakOpportunitiesTable } from './kodiak-opportunities-table'
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
      <KodiakOpportunitiesTable opportunities={results} />
    </CollapsibleMessage>
  )
} 
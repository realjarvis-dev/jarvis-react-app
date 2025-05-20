import { KodiakIsland } from '@/lib/types/kodiak'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { KodiakIslandCard } from './kodiak-island-card'
import { ToolArgsSection } from './section'

interface KodiakOpportunitiesSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Component to display Kodiak Islands opportunities in a grid
 */
export function KodiakOpportunitiesSection({ 
  tool, 
  isOpen, 
  onOpenChange 
}: KodiakOpportunitiesSectionProps) {
  // Show loading skeleton while waiting for results
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  // Create section header
  const header = (
    <ToolArgsSection tool="kodiak_opportunities">
      {`Kodiak Islands Opportunities`}
    </ToolArgsSection>
  )

  // Get results from tool call
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
      {results.length === 0 && <div>No Kodiak Islands opportunities found.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((island: KodiakIsland, i: number) => (
          <KodiakIslandCard key={i} island={island} />
        ))}
      </div>
    </CollapsibleMessage>
  )
} 
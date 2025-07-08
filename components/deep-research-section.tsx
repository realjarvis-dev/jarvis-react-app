'use client'

import { ToolInvocation } from 'ai'
import { Brain, Clock, ExternalLink, Search } from 'lucide-react'
import { useArtifact } from './artifact/artifact-context'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'
import { Section, ToolArgsSection } from './section'

interface DeepResearchSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

interface DeepResearchResult {
  type: string
  query: string
  content: string
  sources: Array<{
    url: string
    title: string
    description?: string
  }>
  model_used: string
  timestamp: string
  from_cache: boolean
  debug_info?: {
    reasoning_steps: number
    web_searches: number
    total_output_items: number
  }
}

export function DeepResearchSection({
  tool,
  isOpen,
  onOpenChange
}: DeepResearchSectionProps) {
  const { open } = useArtifact()
  const isLoading = tool.state === 'call'
  const result: DeepResearchResult | undefined = 
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args?.query as string | undefined

  const header = (
    <button
      type="button"
      onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection tool="deep_research">
        {query}
      </ToolArgsSection>
    </button>
  )

  if (isLoading) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Brain className="h-4 w-4 animate-pulse" />
            <span>Conducting deep research with OpenAI Deep Research API...</span>
          </div>
          <div className="text-xs text-muted-foreground">
            This may take 1-5 minutes as the AI conducts comprehensive research with web browsing
          </div>
          <DefaultSkeleton />
        </div>
      </CollapsibleMessage>
    )
  }

  if (!result) {
    return null
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <div className="space-y-4">
        {/* Research Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground border-b border-border pb-2">
          <div className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            <span>{result.model_used}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
          </div>
          {result.from_cache && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
              Cached
            </span>
          )}
        </div>

        {/* Debug Information */}
        {result.debug_info && (
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border">
            <div className="text-xs font-medium text-muted-foreground mb-2">Deep Research Process:</div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="font-medium">Reasoning Steps:</span> {result.debug_info.reasoning_steps}
              </div>
              <div>
                <span className="font-medium">Web Searches:</span> {result.debug_info.web_searches}
              </div>
              <div>
                <span className="font-medium">Total Operations:</span> {result.debug_info.total_output_items}
              </div>
            </div>
          </div>
        )}

        {/* Research Content */}
        <Section title="Answer">
          <BotMessage message={result.content} />
        </Section>

        {/* Sources Section */}
        {result.sources && result.sources.length > 0 && (
          <Section title="Sources" className="mt-6">
            <div className="grid gap-3">
              {result.sources.map((source, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground leading-tight">
                      {source.title}
                    </div>
                    {source.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {source.description}
                      </div>
                    )}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      title={source.url}
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{source.url}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
              <Search className="h-3 w-3" />
              <span>Found {result.sources.length} sources during deep research</span>
            </div>
          </Section>
        )}

        {/* Research Query Summary */}
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Research Query:</span> {result.query}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Conducted using OpenAI Deep Research API with real-time web search
          </div>
        </div>
      </div>
    </CollapsibleMessage>
  )
} 
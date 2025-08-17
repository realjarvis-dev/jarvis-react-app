'use client'

import { useArtifact } from '@/components/artifact/artifact-context'
import { CHAT_ID } from '@/lib/constants'
import { useChat } from '@ai-sdk/react'
import { ToolInvocation } from 'ai'
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Tag } from 'lucide-react'
import { useState } from 'react'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { Section, ToolArgsSection } from './section'

interface NewsItem {
  id: number
  title: string
  description: string
  url: string
  category: string
  subCategory?: string
  tokenSymbol?: string
  publishedAt: string
  createdAt: string
  imageUrl?: string
}

interface NewsResults {
  articles: NewsItem[]
  total: number
  query: string
  timestamp: string
  source: string
  error?: string
}

interface NewsSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function NewsSection({
  tool,
  isOpen,
  onOpenChange
}: NewsSectionProps) {
  const { status } = useChat({
    id: CHAT_ID
  })
  const isLoading = status === 'submitted' || status === 'streaming'

  const isToolLoading = tool.state === 'call'
  const newsResults: NewsResults =
    tool.state === 'result' ? tool.result : undefined
  const query = tool.args?.query as string | undefined
  const tokenSymbol = tool.args?.token_symbol as string | undefined
  const category = tool.args?.category as string | undefined

  const { open } = useArtifact()
  
  const queryDisplay = [query, tokenSymbol, category].filter(Boolean).join(' • ')
  
  const header = (
    <button
      type="button"
      onClick={() => open({ type: 'tool-invocation', toolInvocation: tool })}
      className="flex items-center justify-between w-full text-left rounded-md p-1 -ml-1"
      title="Open details"
    >
      <ToolArgsSection
        tool="news"
        number={newsResults?.articles?.length}
      >{queryDisplay || 'Latest crypto news'}</ToolArgsSection>
    </button>
  )

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {isLoading && isToolLoading ? (
        <DefaultSkeleton />
      ) : newsResults?.articles ? (
        <Section title="Latest News">
          {newsResults.error ? (
            <div className="text-red-500 text-sm p-4 bg-red-50 rounded-lg">
              Error fetching news: {newsResults.error}
            </div>
          ) : (
            <NewsResults articles={newsResults.articles} />
          )}
        </Section>
      ) : null}
    </CollapsibleMessage>
  )
}

function NewsResults({ articles }: { articles: NewsItem[] }) {
  if (!articles || articles.length === 0) {
    return (
      <div className="text-gray-500 text-sm p-4">
        No news articles found.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <NewsArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}

function NewsArticleCard({ article }: { article: NewsItem }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d ago`
    }
  }

  // Helper function to safely extract string values from potentially complex objects
  const getStringValue = (value: any): string => {
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value !== null) {
      return value.name || value.symbol || value.title || String(value)
    }
    return String(value || '')
  }

  const categoryDisplay = getStringValue(article.category)
  const tokenSymbolDisplay = getStringValue(article.tokenSymbol)
  const fullDescription = getStringValue(article.description)
  
  // Check if description is long enough to warrant expansion
  const isLongContent = fullDescription.length > 200
  const shouldShowExpandButton = isLongContent && !article.url

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {article.imageUrl && (
          <div className="flex-shrink-0">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-16 h-16 rounded-lg object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900 line-clamp-2 leading-tight">
              {getStringValue(article.title)}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {shouldShowExpandButton && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  title={isExpanded ? "Show less" : "Read full article"}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  title="Read full article"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          
          <div className="text-gray-600 text-sm mt-2">
            {isExpanded ? (
              <div className="whitespace-pre-wrap leading-relaxed">
                {fullDescription}
              </div>
            ) : (
              <p className={isLongContent ? "line-clamp-2" : ""}>
                {fullDescription}
              </p>
            )}
          </div>
          
          {shouldShowExpandButton && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800 text-xs mt-1 font-medium transition-colors"
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          )}
          
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(article.publishedAt || article.createdAt)}</span>
            </div>
            
            {categoryDisplay && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>{categoryDisplay}</span>
              </div>
            )}
            
            {tokenSymbolDisplay && (
              <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                {tokenSymbolDisplay}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

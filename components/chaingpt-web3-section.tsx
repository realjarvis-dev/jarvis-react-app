import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ChainGPTStreamResponse, ChainGPTWeb3Response } from '@/lib/types/chaingpt'
import { BookOpen, Brain, Clock, Code, ExternalLink, History, MessageSquare, Palette, Shield, TrendingUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CopyButton } from './copy-button'

interface ChainGPTWeb3SectionProps {
  response: ChainGPTWeb3Response
  isLoading?: boolean
  onRetry?: () => void
  onSaveHistory?: (sessionId: string) => void
}

const getDomainIcon = (domain?: string) => {
  switch (domain) {
    case 'defi':
      return <TrendingUp className="h-4 w-4" />
    case 'nft':
      return <Palette className="h-4 w-4" />
    case 'trading':
      return <TrendingUp className="h-4 w-4" />
    case 'development':
      return <Code className="h-4 w-4" />
    case 'security':
      return <Shield className="h-4 w-4" />
    case 'general_web3':
      return <Brain className="h-4 w-4" />
    default:
      return <MessageSquare className="h-4 w-4" />
  }
}

const getDomainColor = (domain?: string) => {
  switch (domain) {
    case 'defi':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'nft':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'trading':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'development':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'security':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'general_web3':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

const getUserLevelColor = (level?: string) => {
  switch (level) {
    case 'beginner':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'advanced':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

export function ChainGPTWeb3Section({ 
  response, 
  isLoading = false, 
  onRetry, 
  onSaveHistory 
}: ChainGPTWeb3SectionProps) {
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 animate-pulse" />
            ChainGPT Web3 AI is thinking...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (response.error) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
        <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-red-700 dark:text-red-300">
            ChainGPT Web3 AI is temporarily unavailable. 
            {response.error.includes('timeout') ? ' The service timed out.' : ''}
          </p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="flex-shrink-0">
            Retry
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            ChainGPT Web3 AI Response
          </CardTitle>
          <div className="flex items-center gap-2">
            <CopyButton text={response.response} className="" />
            {response.session_id && onSaveHistory && (
              <Button
                onClick={() => onSaveHistory(response.session_id!)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <History className="h-3 w-3" />
                Save
              </Button>
            )}
          </div>
        </div>
        
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2 mt-2">
          {response.domain_focus && (
            <Badge variant="secondary" className={getDomainColor(response.domain_focus)}>
              <span className="flex items-center gap-1">
                {getDomainIcon(response.domain_focus)}
                {response.domain_focus.replace('_', ' ').toUpperCase()}
              </span>
            </Badge>
          )}
          
          {response.user_level && (
            <Badge variant="secondary" className={getUserLevelColor(response.user_level)}>
              <BookOpen className="h-3 w-3 mr-1" />
              {response.user_level.toUpperCase()}
            </Badge>
          )}
          
          {response.response_type && (
            <Badge variant="outline">
              {response.response_type.replace('_', ' ').toUpperCase()}
            </Badge>
          )}
          
          {response.metadata?.tone && (
            <Badge variant="outline">
              {response.metadata.tone.toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Original question */}
          {response.question && (
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Question:
              </p>
              <p className="text-gray-800 dark:text-gray-200">{response.question}</p>
            </div>
          )}
          
          {/* Context if provided */}
          {response.context && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                Context:
              </p>
              <p className="text-blue-800 dark:text-blue-200">{response.context}</p>
            </div>
          )}
          
          <Separator />
          
          {/* AI Response */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1"
                    {...props}
                  >
                    {children}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ),
                code: ({ children, className, ...props }) => {
                  const isInline = !className
                  return isInline ? (
                    <code
                      className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
                pre: ({ children, ...props }) => (
                  <div className="relative">
                    <pre
                      className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto"
                      {...props}
                    >
                      {children}
                    </pre>
                    <CopyButton
                      text={String(children)}
                      className="absolute top-2 right-2"
                    />
                  </div>
                )
              }}
            >
              {response.response}
            </ReactMarkdown>
          </div>
          
          {/* Footer with timestamp and source */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {new Date(response.timestamp).toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <span>Powered by</span>
              <Badge variant="outline" className="text-xs">
                {response.source}
              </Badge>
            </div>
          </div>
          
          {/* Enhanced prompt info (for debugging/advanced users) */}
          {response.metadata?.enhanced_prompt && (
            <details className="text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                View Enhanced Prompt
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                {response.metadata.enhanced_prompt}
              </pre>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Streaming response component
interface ChainGPTStreamSectionProps {
  streamResponse: ChainGPTStreamResponse
  isStreaming?: boolean
  onStreamComplete?: (response: string) => void
}

export function ChainGPTStreamSection({ 
  streamResponse, 
  isStreaming = false, 
  onStreamComplete 
}: ChainGPTStreamSectionProps) {
  if (streamResponse.error) {
    return (
      <Card className="w-full border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <MessageSquare className="h-5 w-5" />
            ChainGPT Web3 AI Streaming Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-400">{streamResponse.error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className={`h-5 w-5 text-blue-600 ${isStreaming ? 'animate-pulse' : ''}`} />
          ChainGPT Web3 AI {isStreaming ? 'Streaming...' : 'Response'}
        </CardTitle>
        
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2 mt-2">
          {streamResponse.domain_focus && (
            <Badge variant="secondary" className={getDomainColor(streamResponse.domain_focus)}>
              <span className="flex items-center gap-1">
                {getDomainIcon(streamResponse.domain_focus)}
                {streamResponse.domain_focus.replace('_', ' ').toUpperCase()}
              </span>
            </Badge>
          )}
          
          {streamResponse.user_level && (
            <Badge variant="secondary" className={getUserLevelColor(streamResponse.user_level)}>
              <BookOpen className="h-3 w-3 mr-1" />
              {streamResponse.user_level.toUpperCase()}
            </Badge>
          )}
          
          <Badge variant="outline">
            {streamResponse.tone.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Original question */}
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Question:
            </p>
            <p className="text-gray-800 dark:text-gray-200">{streamResponse.question}</p>
          </div>
          
          <Separator />
          
          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              <span className="text-sm">ChainGPT AI is generating response...</span>
            </div>
          )}
          
          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {new Date(streamResponse.timestamp).toLocaleString()}
            </div>
            <Badge variant="outline" className="text-xs">
              {streamResponse.source}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

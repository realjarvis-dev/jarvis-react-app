'use client'

import { Badge } from '@/components/ui/badge'
import { Bot, Brain, Loader2, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ToolCallingAnimationProps {
  toolName: string
  stage: 'reasoning' | 'calling' | 'processing' | 'complete'
  description?: string
  className?: string
}

const toolIcons: Record<string, React.ReactNode> = {
  chaingpt_web3_agent: <Bot size={16} className="text-blue-500" />,
  chaingpt_web3_agent_stream: <Bot size={16} className="text-blue-500" />,
  search: <Zap size={16} className="text-green-500" />,
  retrieve: <Zap size={16} className="text-purple-500" />,
  default: <Zap size={16} className="text-gray-500" />
}

const stageMessages: Record<string, string> = {
  reasoning: 'Analyzing your question...',
  calling: 'Calling specialized AI agent...',
  processing: 'Processing with Web3 expertise...',
  complete: 'Response ready'
}

const stageColors: Record<string, string> = {
  reasoning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
  calling: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  processing: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-200',
  complete: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
}

export function ToolCallingAnimation({
  toolName,
  stage,
  description,
  className = ''
}: ToolCallingAnimationProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (stage === 'complete') return

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [stage])

  const getToolDisplayName = (tool: string) => {
    switch (tool) {
      case 'chaingpt_web3_agent':
        return 'ChainGPT Web3 AI'
      case 'chaingpt_web3_agent_stream':
        return 'ChainGPT Web3 AI (Streaming)'
      default:
        return tool.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const getStageIcon = () => {
    switch (stage) {
      case 'reasoning':
        return <Brain size={16} className="animate-pulse text-yellow-600" />
      case 'calling':
      case 'processing':
        return <Loader2 size={16} className="animate-spin text-blue-600" />
      case 'complete':
        return toolIcons[toolName] || toolIcons.default
      default:
        return <Loader2 size={16} className="animate-spin" />
    }
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${stageColors[stage]} ${className}`}>
      <div className="flex items-center gap-2">
        {getStageIcon()}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium">
              {getToolDisplayName(toolName)}
            </Badge>
            {stage !== 'complete' && (
              <span className="text-xs font-mono w-4">
                {dots}
              </span>
            )}
          </div>
          <span className="text-sm font-medium">
            {description || stageMessages[stage]}
          </span>
        </div>
      </div>
      
      {/* Progress indicator */}
      {stage !== 'complete' && (
        <div className="ml-auto">
          <div className="w-2 h-2 rounded-full bg-current animate-pulse opacity-60" />
        </div>
      )}
    </div>
  )
}

// Hook for managing tool calling states
export function useToolCallingAnimation(toolName: string) {
  const [stage, setStage] = useState<'reasoning' | 'calling' | 'processing' | 'complete'>('reasoning')
  const [isVisible, setIsVisible] = useState(false)

  const startToolCall = () => {
    setIsVisible(true)
    setStage('reasoning')
    
    // Simulate reasoning phase
    setTimeout(() => setStage('calling'), 800)
    setTimeout(() => setStage('processing'), 1500)
  }

  const completeToolCall = () => {
    setStage('complete')
    setTimeout(() => setIsVisible(false), 2000)
  }

  const resetToolCall = () => {
    setStage('reasoning')
    setIsVisible(false)
  }

  return {
    stage,
    isVisible,
    startToolCall,
    completeToolCall,
    resetToolCall
  }
}

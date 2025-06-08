'use client'

import { cn } from '@/lib/utils'
import { BarChart3, Building, Lightbulb, LineChart, Receipt, TrendingUp, Users2, Zap } from 'lucide-react'

interface LightweightSuggestionPillsProps {
  onSelectSuggestion: (suggestion: string) => void
}

interface Suggestion {
  text: string
  icon: JSX.Element
}

const suggestions: Suggestion[] = [
  { text: 'Show my portfolio', icon: <BarChart3 className="h-3 w-3 flex-shrink-0" /> },
  { text: 'What are gas fees?', icon: <Receipt className="h-3 w-3 flex-shrink-0" /> },
  { text: 'Best DeFi opportunities?', icon: <TrendingUp className="h-3 w-3 flex-shrink-0" /> },
  { text: 'Explain yield farming', icon: <Lightbulb className="h-3 w-3 flex-shrink-0" /> },
  { text: 'Compare lending protocols', icon: <Building className="h-3 w-3 flex-shrink-0" /> },
  { text: 'Market analysis', icon: <LineChart className="h-3 w-3 flex-shrink-0" /> },
  { text: 'Trading strategies', icon: <Zap className="h-3 w-3 flex-shrink-0" /> },
  { text: 'Risk management', icon: <Users2 className="h-3 w-3 flex-shrink-0" /> }
]

export function LightweightSuggestionPills({ onSelectSuggestion }: LightweightSuggestionPillsProps) {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex gap-2 px-4 py-2 overflow-x-auto hide-scrollbar">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelectSuggestion(suggestion.text)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs whitespace-nowrap rounded-full',
              'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white',
              'border border-white/20 hover:border-white/30',
              'transition-colors duration-200'
            )}
          >
            {suggestion.icon}
            {suggestion.text}
          </button>
        ))}
      </div>
    </div>
  )
}
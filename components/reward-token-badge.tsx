'use client'

import { Badge } from './ui/badge'
import { formatRewardToken, formatRewardTokenAsync, getExplorerUrl } from '../lib/defillama/utils'
import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'

interface RewardTokenBadgeProps {
  token: string
  chain?: string
  className?: string
}

export function RewardTokenBadge({ token, chain = 'ethereum', className }: RewardTokenBadgeProps) {
  const [displayToken, setDisplayToken] = useState(() => formatRewardToken(token))
  const [isLoading, setIsLoading] = useState(false)
  const [isUnknownToken, setIsUnknownToken] = useState(false)

  useEffect(() => {
    // Only do async lookup if the sync version returned a shortened address
    if (displayToken.includes('...') && token.startsWith('0x')) {
      setIsLoading(true)
      
      formatRewardTokenAsync(token, chain)
        .then(result => {
          setDisplayToken(result)
          // If result still contains '...' after API lookup, it's an unknown token
          setIsUnknownToken(result.includes('...'))
        })
        .catch(error => {
          console.warn('Failed to lookup token:', error)
          setIsUnknownToken(true)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [token, chain, displayToken])

  // If it's an unknown token (contains '...' and starts with 0x), make it a clickable link
  const shouldShowLink = displayToken.includes('...') && token.startsWith('0x')

  if (shouldShowLink) {
    return (
      <a
        href={getExplorerUrl(token, chain)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
        onClick={(e) => e.stopPropagation()} // Prevent parent click events
      >
        <Badge 
          variant="outline" 
          className={`h-4 px-1.5 text-xs font-mono border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-colors cursor-pointer ${className || ''}`}
        >
          <div className="flex items-center gap-1">
            {isLoading ? (
              <span className="opacity-70">
                {displayToken}...
              </span>
            ) : (
              <>
                <span>{displayToken}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </>
            )}
          </div>
        </Badge>
      </a>
    )
  }

  return (
    <Badge 
      variant="outline" 
      className={`h-4 px-1.5 text-xs font-mono border-white/20 text-white ${className || ''}`}
    >
      {isLoading ? (
        <span className="opacity-70">
          {displayToken}...
        </span>
      ) : (
        displayToken
      )}
    </Badge>
  )
}
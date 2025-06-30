'use client'

import { getProtocolUrl, getProtocolUrlAsync } from '../lib/defillama/utils'
import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'

interface ProtocolLinkProps {
  protocolName: string
  className?: string
  children?: React.ReactNode
}

export function ProtocolLink({ protocolName, className, children }: ProtocolLinkProps) {
  const [protocolUrl, setProtocolUrl] = useState<string | null>(() => getProtocolUrl(protocolName))
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Only do async lookup if the sync version didn't find a URL
    if (!protocolUrl) {
      setIsLoading(true)
      
      getProtocolUrlAsync(protocolName)
        .then(result => {
          setProtocolUrl(result)
        })
        .catch(error => {
          console.warn('Failed to lookup protocol URL:', error)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [protocolName, protocolUrl])

  // If we have a URL, make it clickable
  if (protocolUrl) {
    return (
      <a
        href={protocolUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 hover:text-blue-400 transition-colors cursor-pointer ${className || ''}`}
        onClick={(e) => e.stopPropagation()} // Prevent parent click events
      >
        <span>{children || protocolName}</span>
        <ExternalLink className="w-3 h-3 opacity-70" />
      </a>
    )
  }

  // If no URL found, display as plain text
  return (
    <span className={className}>
      {children || protocolName}
      {isLoading && <span className="opacity-50 ml-1">...</span>}
    </span>
  )
}
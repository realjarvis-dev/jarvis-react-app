'use client'

import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { Globe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toggle } from './ui/toggle'

interface SearchModeToggleProps {
  initialSearchMode?: boolean
}

export function SearchModeToggle({ initialSearchMode }: SearchModeToggleProps) {
  const [isSearchMode, setIsSearchMode] = useState(initialSearchMode ?? false)

  useEffect(() => {
    if (initialSearchMode === undefined) {
      const savedMode = getCookie('search-mode')
      if (savedMode !== null) {
        setIsSearchMode(savedMode === 'true')
      } else {
        setCookie('search-mode', 'true')
        setIsSearchMode(true)
      }
    }
  }, [initialSearchMode])

  const handleSearchModeChange = (pressed: boolean) => {
    setIsSearchMode(pressed)
    setCookie('search-mode', pressed.toString())
  }

  return (
    <Toggle
      aria-label="Toggle search mode"
      pressed={isSearchMode}
      onPressedChange={handleSearchModeChange}
      variant="outline"
      className={cn(
        'gap-1 px-3 border border-input text-muted-foreground bg-background',
        'data-[state=on]:bg-accent-blue',
        'data-[state=on]:text-accent-blue-foreground',
        'data-[state=on]:border-accent-blue-border',
        'hover:bg-accent hover:text-accent-foreground rounded-full',
        'h-8 sm:h-10'
      )}
    >
      <Globe className="size-4" />
      <span className="text-xs">Search</span>
    </Toggle>
  )
}

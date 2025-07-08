'use client'

import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { Globe, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

export function SearchModeToggle() {
  const [searchEnabled, setSearchEnabled] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedMode = getCookie('search-mode')
    if (savedMode !== null) {
      setSearchEnabled(savedMode === 'true')
    } else {
      setCookie('search-mode', 'true')
      setSearchEnabled(true)
    }
  }, [])

  const handleToggle = () => {
    const newMode = !searchEnabled
    setSearchEnabled(newMode)
    setCookie('search-mode', newMode.toString())
  }

  if (!mounted) {
    return (
      <div className={cn(
        'gap-1 px-3 border border-input text-muted-foreground bg-background',
        'rounded-full min-w-20 h-8 sm:h-10 flex items-center justify-center'
      )}>
        <Globe className="size-4" />
        <span className="text-xs">Search</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'gap-1 px-3 border border-input text-muted-foreground bg-background',
        'hover:bg-accent hover:text-accent-foreground rounded-full',
        'h-8 sm:h-10 min-w-20 flex items-center justify-center transition-colors',
        searchEnabled && 'bg-accent-blue text-accent-blue-foreground border-accent-blue-border'
      )}
    >
      {searchEnabled ? (
        <>
          <Globe className="size-4" />
          <span className="text-xs">Search</span>
        </>
      ) : (
        <>
          <Search className="size-4" />
          <span className="text-xs">Off</span>
        </>
      )}
    </button>
  )
}

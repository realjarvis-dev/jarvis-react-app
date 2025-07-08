'use client'

import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { Zap, ZapOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export function DeepResearchToggle() {
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedMode = getCookie('deep-research-mode')
    if (savedMode !== null) {
      setDeepResearchEnabled(savedMode === 'true')
    } else {
      setCookie('deep-research-mode', 'false')
      setDeepResearchEnabled(false)
    }
  }, [])

  const handleToggle = () => {
    const newMode = !deepResearchEnabled
    setDeepResearchEnabled(newMode)
    setCookie('deep-research-mode', newMode.toString())
  }

  if (!mounted) {
    return (
      <div className={cn(
        'gap-1 px-3 border border-input text-muted-foreground bg-background',
        'rounded-full min-w-24 h-8 sm:h-10 flex items-center justify-center'
      )}>
        <ZapOff className="size-4" />
        <span className="text-xs">Deep Research</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'gap-1 px-3 border border-input text-muted-foreground bg-background',
        'hover:bg-accent hover:text-accent-foreground rounded-full',
        'h-8 sm:h-10 min-w-24 flex items-center justify-center transition-colors',
        deepResearchEnabled && 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-600'
      )}
    >
      {deepResearchEnabled ? (
        <>
          <Zap className="size-4" />
          <span className="text-xs">Deep Research</span>
        </>
      ) : (
        <>
          <ZapOff className="size-4" />
          <span className="text-xs">Deep Research</span>
        </>
      )}
    </button>
  )
} 
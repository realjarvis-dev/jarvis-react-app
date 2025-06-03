'use client'

import { cn } from '@/lib/utils'
import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toggle } from './ui/toggle'

interface DemoToggleProps {
  isDemoMode?: boolean
  onDemoModeChange?: (enabled: boolean) => void
}

export function DemoToggle({ isDemoMode, onDemoModeChange }: DemoToggleProps) {
  const [mounted, setMounted] = useState(false)
  const [internalDemoMode, setInternalDemoMode] = useState(isDemoMode ?? true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof isDemoMode === 'boolean') setInternalDemoMode(isDemoMode)
  }, [isDemoMode])

  if (!mounted) {
    return (
      <Toggle
        aria-label="Toggle demo mode"
        variant="outline"
        className={cn(
          'gap-1 px-3 border border-input text-muted-foreground bg-background',
          'hover:bg-accent hover:text-accent-foreground rounded-full',
          'h-8 sm:h-10',
          'transition-colors duration-150'
        )}
      >
        <FlaskConical className="size-4" />
        <span className="text-xs">Demo</span>
      </Toggle>
    )
  }

  return (
    <Toggle
      aria-label="Toggle demo mode"
      pressed={internalDemoMode}
      onPressedChange={val => {
        setInternalDemoMode(val)
        onDemoModeChange?.(val)
      }}
      variant="outline"
      className={cn(
        'gap-1 px-3 border border-input text-muted-foreground bg-background',
        'data-[state=on]:bg-accent-blue data-[state=on]:text-accent-blue-foreground data-[state=on]:border-accent-blue-border',
        'hover:bg-accent hover:text-accent-foreground rounded-full',
        'h-8 sm:h-10',
        'transition-colors duration-150'
      )}
    >
      <FlaskConical className="size-4" />
      <span className="text-xs font-medium">Demo</span>
    </Toggle>
  )
}
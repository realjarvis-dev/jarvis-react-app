'use client'

import { useNetwork } from '@/lib/network/context'
import { cn } from '@/lib/utils'
import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toggle } from './ui/toggle'

export function DemoToggle() {
  const { isDemoMode, setIsDemoMode } = useNetwork()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      pressed={isDemoMode}
      onPressedChange={val => {
        setIsDemoMode(val)
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

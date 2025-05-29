'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface DemoToggleProps {
  isDemoMode: boolean
  onDemoModeChange: (enabled: boolean) => void
}

export function DemoToggle({ isDemoMode, onDemoModeChange }: DemoToggleProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-input rounded-full bg-background h-10">
        <div className="w-6 h-3 bg-muted rounded-full" />
        <span className="text-xs text-muted-foreground">DEMO</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => onDemoModeChange(!isDemoMode)}
      className="flex items-center gap-2 px-3 py-2 border border-input rounded-full bg-background hover:bg-accent transition-colors h-10"
    >
      <div
        className="relative w-6 h-3 rounded-full transition-all duration-200 cursor-pointer"
        style={{
          backgroundColor: isDemoMode ? '#22c55e' : '#d1d5db'
        }}
      >
        <div
          className={cn(
            'absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all duration-200 shadow-sm',
            isDemoMode ? 'translate-x-3' : 'translate-x-0.5'
          )}
        />
      </div>
      <span 
        className="text-xs font-medium transition-colors"
        style={{
          color: isDemoMode ? '#16a34a' : '#6b7280'
        }}
      >
        DEMO
      </span>
    </button>
  )
} 
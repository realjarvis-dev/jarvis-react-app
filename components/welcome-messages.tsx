'use client'

import { cn } from '@/lib/utils'

interface WelcomeMessageProps {
  seed?: number
  className?: string
}

export function WelcomeMessage({ seed = 1, className }: WelcomeMessageProps) {
  return (
    <div className={cn("text-center max-w-2xl mx-auto", className)}>
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        Welcome to Jarvis
      </h1>
      <p className="text-lg sm:text-xl text-muted-foreground mb-6">
        Your AI investment assistant for DeFi, portfolio management, and crypto insights.
      </p>
    </div>
  )
}

export function getAllWelcomeMessages() {
  return [
    { component: WelcomeMessage, id: 'default' }
  ]
}
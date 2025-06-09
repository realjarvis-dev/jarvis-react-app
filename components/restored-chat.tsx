'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

// Restore the working chat components with dynamic loading
const WorkingChat = dynamic(() => import('./working-chat-impl'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
  </div>
})

interface RestoredChatProps {
  id: string
  savedMessages?: any[]
  query?: string
}

export function RestoredChat({ id, savedMessages = [], query }: RestoredChatProps) {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    // Load after a short delay to ensure LCP is captured first
    const timer = setTimeout(() => setShouldLoad(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Show loading state immediately, then load full chat
  if (!shouldLoad) {
    return (
      <div className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center',
        'bg-gradient-to-br from-slate-900 to-slate-800 text-white'
      )}>
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Welcome to Jarvis
          </h1>
          <p className="text-slate-300 mb-4">Your AI investment assistant</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
        </div>
      </div>
    )
  }

  return <WorkingChat id={id} savedMessages={savedMessages} query={query} />
}
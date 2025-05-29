'use client'

import { useState, useEffect } from 'react'
import { ChatPanel as OriginalChatPanel } from './chat-panel'
import { ChatPanel as OptimizedChatPanel } from './optimized-chat-panel'
import { Button } from './ui/button'

interface ChatPanelToggleProps {
  // Pass through all props required by both chat panel implementations
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: any[]
  setMessages: (messages: any[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
  isAutoScroll: boolean
}

export function ChatPanelToggle(props: ChatPanelToggleProps) {
  // Default to optimized version
  const [useOptimized, setUseOptimized] = useState(true)
  
  // Store preference in localStorage
  useEffect(() => {
    const storedPreference = localStorage.getItem('useOptimizedChatPanel')
    if (storedPreference !== null) {
      setUseOptimized(storedPreference === 'true')
    }
  }, [])
  
  // Update localStorage when preference changes
  useEffect(() => {
    localStorage.setItem('useOptimizedChatPanel', String(useOptimized))
  }, [useOptimized])
  
  return (
    <div className="relative">
      {/* Toggle button */}
      <div className="absolute top-0 right-0 z-50 p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setUseOptimized(!useOptimized)}
          className="text-xs"
        >
          {useOptimized ? 'Using Optimized' : 'Using Original'}
        </Button>
      </div>
      
      {/* Render the selected chat panel */}
      {useOptimized ? (
        <OptimizedChatPanel {...props} />
      ) : (
        <OriginalChatPanel {...props} />
      )}
    </div>
  )
}

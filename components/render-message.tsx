'use client'

import { Message } from 'ai'
import { useMemo } from 'react'

interface RenderMessageProps {
  message: Message
  chatId: string
  onQuerySelect?: (query: string) => void
  onUpdateMessage?: (messageId: string, newContent: string) => void
  reload?: (messageId: string) => void
}

export function RenderMessage({ 
  message, 
  chatId, 
  onQuerySelect, 
  onUpdateMessage, 
  reload 
}: RenderMessageProps) {
  // Simple message rendering for now
  const relatedQuestions = useMemo(() => [], [])

  return (
    <div className="group relative mb-4 flex items-start gap-2 md:gap-4">
      <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow ${
        message.role === 'user' ? 'bg-blue-500' : 'bg-primary'
      }`}>
        <span className="text-xs font-bold text-white">
          {message.role === 'user' ? 'U' : 'J'}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="prose prose-neutral prose-sm dark:prose-invert max-w-none break-words">
          {message.content}
        </div>
      </div>
    </div>
  )
}
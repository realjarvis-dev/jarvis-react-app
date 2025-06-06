'use client'

import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { useRef } from 'react'
import { ReadOnlyMessages } from './read-only-messages'

export function ReadOnlyChat({
  savedMessages = []
}: {
  savedMessages: Message[]
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        savedMessages.length === 0 ? 'items-center justify-center' : ''
      )}
      data-testid="read-only-chat"
    >
      <ReadOnlyMessages
        messages={savedMessages}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  )
} 
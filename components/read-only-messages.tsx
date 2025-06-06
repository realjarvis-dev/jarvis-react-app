'use client'

import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ReadOnlyMessage } from './read-only-message'

interface ReadOnlyMessagesProps {
  messages: Message[]
  scrollContainerRef: React.RefObject<HTMLDivElement>
}

export function ReadOnlyMessages({
  messages,
  scrollContainerRef
}: ReadOnlyMessagesProps) {
  if (!messages.length) return null

  return (
    <div
      id="scroll-container"
      ref={scrollContainerRef}
      role="list"
      aria-roledescription="chat messages"
      className={cn(
        'relative w-full pt-14',
        messages.length > 0 ? 'flex-1 overflow-y-auto overscroll-contain' : ''
      )}
      style={{ contain: 'strict' }}
    >
      <div className="relative mx-auto w-full max-w-3xl px-4">
        {messages.map(message => (
          <div key={message.id} className="mb-4 flex flex-col gap-4">
            <ReadOnlyMessage message={message} />
          </div>
        ))}
        <div />
      </div>
      <div className="h-24" />
    </div>
  )
} 
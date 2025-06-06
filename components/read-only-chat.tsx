'use client'

import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { useRef, useState } from 'react'
import { RenderMessage } from './render-message'

interface ReadOnlyChatProps {
  messages: Message[]
  id: string
}

export function ReadOnlyChat({ messages, id }: ReadOnlyChatProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  if (!messages.length) return null

  // Always open all messages in read-only mode
  const getIsOpen = (id: string) => true

  const handleOpenChange = (id: string, open: boolean) => {
    setOpenStates(prev => ({
      ...prev,
      [id]: open
    }))
  }

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col"
      data-testid="read-only-chat"
    >
      <div
        id="scroll-container"
        ref={scrollContainerRef}
        role="list"
        aria-roledescription="chat messages"
        className={cn(
          'relative w-full pt-14',
          'flex-1 overflow-y-auto overscroll-contain'
        )}
        style={{ contain: 'strict' }}
      >
        <div className="relative mx-auto w-full max-w-3xl px-4">
          {messages.map(message => (
            <div key={message.id} className="mb-4 flex flex-col gap-4">
              <RenderMessage
                message={message}
                messageId={message.id}
                getIsOpen={getIsOpen}
                onOpenChange={handleOpenChange}
                onQuerySelect={() => {}} // No-op function
                chatId={id}
                readOnly={true}
                // Don't pass addToolResult, onUpdateMessage, or reload
              />
            </div>
          ))}
          <div />
        </div>
        <div className="h-24" />
      </div>
      <div className="flex justify-center items-center p-4 text-sm text-gray-500">
        This is a read-only view of a shared conversation
      </div>
    </div>
  )
} 
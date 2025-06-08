'use client'

import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { ChatRequestOptions } from 'ai'
import { Message } from 'ai/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './optimized-chat-panel'
import { useAuthHeaders, useTrialLimits } from '@/hooks/use-auth-headers'

export function Chat({
  id,
  savedMessages = [],
  query
}: {
  id: string
  savedMessages?: Message[]
  query?: string
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Use custom hooks for cleaner code and better performance
  const { headers, ready, authenticated } = useAuthHeaders()
  const { checkTrialLimit } = useTrialLimits()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Temporarily simplified for LCP testing
  const [messages, setMessages] = useState(savedMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('Chat submit:', input)
  }
  
  const stop = () => setIsLoading(false)
  const append = (message: any) => {
    setMessages(prev => [...prev, message])
  }
  const data = undefined
  const setData = () => {}
  const addToolResult = () => {}
  const reload = async () => null
  const status = 'awaiting_message'

  const { anchorRef, isAutoScroll } = useAutoScroll({
    isLoading,
    dependency: messages.length,
    isStreaming: () => status === 'streaming',
    scrollContainer: scrollContainerRef,
    threshold: 50
  })

  useEffect(() => {
    setMessages(savedMessages)
  }, [id])


  const onQuerySelect = (query: string) => {
    const sendMessage = () => {
      append({
        role: 'user',
        content: query
      })
    }
    if (!ready) {
      toast.error('Still initializing, please wait…')
      return
    }
    if (!authenticated) {
      // check trial limit, execute callback if limit reached
      checkTrialLimit(
        () => {
          toast.error('No trials left – please log in!')
        },
        () => {
          sendMessage()
        }
      )
      return
    }
    sendMessage()
  }

  const handleUpdateAndReloadMessage = async (
    messageId: string,
    newContent: string
  ) => {
    setMessages(currentMessages =>
      currentMessages.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    )

    try {
      const messageIndex = messages.findIndex(msg => msg.id === messageId)
      if (messageIndex === -1) return

      const messagesUpToEdited = messages.slice(0, messageIndex + 1)

      setMessages(messagesUpToEdited)

      setData(undefined)

      await reload({
        body: {
          chatId: id,
          regenerate: true
        }
      })
    } catch (error) {
      console.error('Failed to reload after message update:', error)
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
  }

  const handleReloadFrom = async (
    messageId: string,
    options?: ChatRequestOptions
  ) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      const userMessageIndex = messages
        .slice(0, messageIndex)
        .findLastIndex(m => m.role === 'user')
      if (userMessageIndex !== -1) {
        const trimmedMessages = messages.slice(0, userMessageIndex + 1)
        setMessages(trimmedMessages)
        return await reload(options)
      }
    }
    return await reload(options)
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const sendMessage = () => {
      e.preventDefault()
      setData(undefined)
      handleSubmit(e)
    }
    if (!ready) {
      toast.error('Still initializing, please wait…')
      return
    }
    if (!authenticated) {
      // check trial limit, execute callback if limit reached
      checkTrialLimit(
        () => {
          toast.error('No trials left – please log in!')
          e.preventDefault()
          setData(undefined)
        },
        () => {
          sendMessage()
        }
      )
      return
    }

    // has to keep it for authenticated users
    sendMessage()
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center' : ''
      )}
      data-testid="full-chat"
    >
      <ChatMessages
        messages={messages}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
        anchorRef={anchorRef}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
        isAutoScroll={isAutoScroll}
      />
    </div>
  )
}

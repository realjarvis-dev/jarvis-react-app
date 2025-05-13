'use client'

import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import { ChatRequestOptions } from 'ai'
import { Message } from 'ai/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useTransition, useState } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

const TRIAL_KEY = 'anon_trials';
const MAX_TRIALS = 2;

export function Chat({
  id,
  savedMessages = [],
  query,
  models
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  models?: Model[]
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { user, ready, authenticated } = usePrivy()
  const [headers, setHeaders] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      setHeaders({
        'x-user-id': 'anonymous',
        Authorization: ''
      })
      return
    } else {
      ;(async () => {
        try {
          const token = await getAccessToken()
          setHeaders({
            'x-user-id': user?.id || 'anonymous',
            Authorization: `Bearer ${token}`
          })
        } catch (error) {
          console.error('Failed to get access token:', error)
          setHeaders({
            'x-user-id': user?.id || 'anonymous',
            Authorization: ''
          })
        }
      })()
    }
  }, [user?.id, ready, authenticated])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    stop,
    append,
    data,
    setData,
    addToolResult,
    reload
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id
    },
    headers,
    onFinish: () => {
      router.replace(`/search/${id}`)
      startTransition(() => {
        router.refresh()
      })
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    sendExtraMessageFields: false,
    experimental_throttle: 100
  })

  const isLoading = status === 'submitted' || status === 'streaming'

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
    append({
      role: 'user',
      content: query
    })
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
      // 1) haven’t initialized Privy yet?
    if (!ready) {
      toast.error('Still initializing, please wait…')
      return
    }
    // 2) anon user out of trials?
    const isAnon = !authenticated
    let trials = parseInt(localStorage.getItem(TRIAL_KEY) ?? `${MAX_TRIALS}`, 10);
    if (isAnon && trials !== null && trials <= 0) {
      toast.error('No trials left – please log in!')
      setData(undefined)
      return
    }

    // 3) decrement and persist
    if (isAnon && trials !== null) {
      const next = trials - 1
      localStorage.setItem(TRIAL_KEY, String(next))
    }
    e.preventDefault()
    setData(undefined)
    handleSubmit(e)
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
        models={models}
        isAutoScroll={isAutoScroll}
      />
    </div>
  )
}

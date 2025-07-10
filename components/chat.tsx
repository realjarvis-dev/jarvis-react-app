'use client'

import { CHAT_ID } from '@/lib/constants'
import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import { ChatRequestOptions } from 'ai'
import { Message } from 'ai/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import useLocalStorage from 'use-local-storage-state'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './optimized-chat-panel'
import { FloatingAskJarvis } from './floating-ask-jarvis'

const TRIAL_KEY = 'anon_trials'
const MAX_TRIALS = 2

export function Chat({
  id,
  savedMessages = [],
  query,
  isReadOnly = false
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  isReadOnly?: boolean
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { user, ready, authenticated } = usePrivy()
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [anonId, setAnonId] = useLocalStorage('anonUserId', {
    defaultValue: ''
  })
  const [anonTrial, setAnonTrial] = useLocalStorage('anonTrial', {
    defaultValue: MAX_TRIALS
  })

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      if (!anonId) {
        const newAnonId = crypto.randomUUID()
        console.log('anonId', newAnonId)
        setAnonId(newAnonId)
        setHeaders({
          'x-user-id': newAnonId,
          'allow-web3-tools': 'readonly'
        })
      } else {
        setHeaders({
          'x-user-id': anonId,
          'allow-web3-tools': 'readonly'
        })
      }
      return
    } else {
      ;(async () => {
        try {
          const token = await getAccessToken()
          setHeaders({
            'x-user-id': user!.id,
            'allow-web3-tools': 'true'
          })
        } catch (error) {
          console.error('Failed to get access token:', error)
          setHeaders({
            'x-user-id': 'anonymous',
            'allow-web3-tools': 'readonly'
          })
        }
      })()
    }
  }, [user?.id, ready, authenticated, anonId, setAnonId])
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
      setIsSaving(true)
      // Update URL without triggering re-render using History API
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname !== `/search/${id}`) {
          window.history.replaceState(null, '', `/search/${id}`)
        }
        startTransition(() => {
          setIsSaving(false)
        })
      }, 100) // Minimal delay just to ensure proper timing
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
      setIsSaving(false)
    },
    sendExtraMessageFields: false,
    experimental_throttle: 100
  })

  const isLoading = status === 'submitted' || status === 'streaming'
  const isProcessing = isLoading || isSaving

  const { anchorRef, isAutoScroll } = useAutoScroll({
    isLoading: isProcessing,
    dependency: messages.length,
    isStreaming: () => status === 'streaming',
    scrollContainer: scrollContainerRef,
    threshold: 50,
    lastMessageId: messages.length > 0 ? messages[messages.length - 1].id : undefined
  })

  useEffect(() => {
    setMessages(savedMessages)
  }, [id])

  const checkTrialLimit = (
    limitReachCallback: () => void,
    limitNotReachedCallback: () => void
  ) => {
    if (!ready) {
      toast.error('Still initializing, please wait…')
      return
    }
    if (authenticated) {
      return
    }
    if (anonTrial <= 0) {
      console.log('anonTrial', anonTrial)
      limitReachCallback()
      return
    }

    setAnonTrial(anonTrial - 1)
    limitNotReachedCallback()
  }

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

  const handleAskJarvis = (selectedText: string) => {
    // Add the selected text to the input field
    const prompt = `Please explain this: "${selectedText}"`
    handleInputChange({
      target: { value: prompt }
    } as React.ChangeEvent<HTMLTextAreaElement>)
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
        onQuerySelect={isReadOnly ? undefined : onQuerySelect}
        isLoading={isProcessing}
        chatId={id}
        addToolResult={isReadOnly ? undefined : addToolResult}
        anchorRef={anchorRef}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={isReadOnly ? undefined : handleUpdateAndReloadMessage}
        reload={isReadOnly ? undefined : handleReloadFrom}
      />
      {!isReadOnly && (
        <ChatPanel
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={onSubmit}
          isLoading={isProcessing}
          messages={messages}
          setMessages={setMessages}
          stop={stop}
          query={query}
          append={append}
          isAutoScroll={isAutoScroll}
          chatId={id}
        />
      )}
      {isReadOnly && (
        <div className="w-full shrink-0 bg-background py-4 text-center text-sm text-muted-foreground">
          This is a read-only shared conversation
        </div>
      )}
      {!isReadOnly && <FloatingAskJarvis onAskJarvis={handleAskJarvis} />}
    </div>
  )
}
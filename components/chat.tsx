'use client'

// Temporarily disable constants import
// import { CHAT_ID } from '@/lib/constants'
const CHAT_ID = 'search'
// Temporarily disable auto-scroll to test for blocking
// import { useAutoScroll } from '@/lib/hooks/use-auto-scroll'
// Temporarily disable utils import
// import { cn } from '@/lib/utils'
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ')
// Temporarily remove AI SDK import to test for blocking
// import { useChat } from '@ai-sdk/react'
// Temporarily remove all AI package imports
// import { ChatRequestOptions } from 'ai'
// import { Message } from 'ai/react'

// Simple type definitions to avoid AI imports
type ChatRequestOptions = any
type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: any[]
}
// Temporarily disable Next.js imports
// import { useRouter } from 'next/navigation'
// Minimize React imports too
import { useRef } from 'react'
// Temporarily remove toast to test for blocking
// import { toast } from 'sonner'
const toast = { error: () => {}, success: () => {} }
// Test with ultra-minimal messages
// import { ChatMessages } from './chat-messages'
import { UltraMinimalChatMessages } from './ultra-minimal-chat-messages'
// Test with ultra-minimal panel
// import { ChatPanel } from './optimized-chat-panel'
import { UltraMinimalChatPanel } from './ultra-minimal-chat-panel'
// Temporarily disable auth hooks to test for blocking
// import { useAuthHeaders, useTrialLimits } from '@/hooks/use-auth-headers'

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
  
  // Temporarily disable auth hooks to test for blocking
  // const { headers, ready, authenticated } = useAuthHeaders()
  // const { checkTrialLimit } = useTrialLimits()
  const headers = {}
  const ready = true
  const authenticated = false
  const checkTrialLimit = (limitReachedCallback: () => void, limitNotReachedCallback: () => void) => {
    limitNotReachedCallback()
  }
  // Temporarily disable router and transitions to test for blocking
  // const router = useRouter()
  // const [isPending, startTransition] = useTransition()
  const router = { push: () => {} }
  const isPending = false
  const startTransition = (fn: () => void) => fn()

  // Temporarily simplified for LCP testing - remove state
  const messages = savedMessages || []
  const input = ''
  const isLoading = false
  const setMessages = () => {}
  const setInput = () => {}
  const setIsLoading = () => {}
  
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

  // Temporarily disable auto-scroll to test for blocking
  const anchorRef = useRef<HTMLDivElement>(null)
  const isAutoScroll = true

  // Temporarily remove useEffect
  // useEffect(() => {
  //   setMessages(savedMessages)
  // }, [id])


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

      setData()

      await reload()
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
        return await reload()
      }
    }
    return await reload()
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const sendMessage = () => {
      e.preventDefault()
      setData()
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
          setData()
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
      <UltraMinimalChatMessages />
      <UltraMinimalChatPanel />
    </div>
  )
}

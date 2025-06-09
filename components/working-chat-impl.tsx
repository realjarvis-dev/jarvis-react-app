'use client'

import { CHAT_ID } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { Message } from 'ai/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

interface WorkingChatImplProps {
  id: string
  savedMessages?: Message[]
  query?: string
}

// Simple message component
function MessageComponent({ message }: { message: Message }) {
  return (
    <div className={cn(
      'p-4 rounded-lg mb-4 max-w-4xl',
      message.role === 'user' 
        ? 'bg-blue-600 text-white ml-auto' 
        : 'bg-slate-700 text-white mr-auto'
    )}>
      <div className="text-sm font-medium mb-1">
        {message.role === 'user' ? 'You' : 'Jarvis'}
      </div>
      <div className="whitespace-pre-wrap">{message.content}</div>
    </div>
  )
}

// Simple input component
function ChatInput({ 
  input, 
  setInput, 
  handleSubmit, 
  isLoading 
}: {
  input: string
  setInput: (value: string) => void
  handleSubmit: (e: React.FormEvent) => void
  isLoading: boolean
}) {
  return (
    <div className="border-t border-slate-600 p-4">
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me about investing, DeFi, or market analysis..."
          className="flex-1 p-3 bg-slate-700 text-white border border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={1}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className={cn(
            'px-6 py-3 rounded-lg font-medium transition-colors',
            isLoading || !input.trim()
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default function WorkingChatImpl({ 
  id, 
  savedMessages = [], 
  query 
}: WorkingChatImplProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Use the actual working useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading,
    stop,
    append,
    setInput
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id
    },
    headers: {
      'x-user-id': 'anonymous', // Simplified for now
      'allow-web3-tools': 'false'
    },
    onFinish: () => {
      router.replace(`/search/${id}`)
      startTransition(() => {
        router.refresh()
      })
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    }
  })

  // Set initial query if provided
  useEffect(() => {
    if (query && input === '' && messages.length === 0) {
      setInput(query)
    }
  }, [query, input, messages.length, setInput])

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col bg-slate-900 text-white">
      {/* Messages area */}
      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl">
              <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Welcome to Jarvis
              </h1>
              <p className="text-slate-300 text-lg mb-6">
                Your AI investment assistant. Ask me about DeFi, portfolio management, market analysis, or any crypto-related questions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {[
                  "What are the best DeFi yield opportunities?",
                  "How do I analyze a crypto portfolio?",
                  "Explain liquidity mining risks",
                  "What's happening in the markets today?"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <MessageComponent key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="bg-slate-700 text-white p-4 rounded-lg mr-auto max-w-4xl">
                <div className="text-sm font-medium mb-1">Jarvis</div>
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  Thinking...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}
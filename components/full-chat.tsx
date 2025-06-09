'use client'

import { useState, useEffect } from 'react'
import { UltraMinimalChat } from './ultra-minimal-chat'

// Simplified but functional chat component
interface FullChatProps {
  id: string
  savedMessages?: any[]
  query?: string
}

export function FullChat({ id, savedMessages = [], query }: FullChatProps) {
  const [messages, setMessages] = useState(savedMessages)
  const [input, setInput] = useState(query || '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input, id: Date.now().toString() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Real API call to your chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          id: id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      if (reader) {
        // Create assistant message immediately
        const assistantId = (Date.now() + 1).toString()
        setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.content) {
                  assistantMessage += data.content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantId 
                      ? { ...msg, content: assistantMessage }
                      : msg
                  ))
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      setIsLoading(false)
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        id: (Date.now() + 1).toString()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Messages area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: messages.length === 0 ? 'center' : 'flex-start',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        overflowY: 'auto'
      }}>
        {messages.length === 0 ? (
          <div>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              marginBottom: '1rem',
              background: 'linear-gradient(45deg, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Welcome to Jarvis - Enhanced
            </h1>
            <p style={{ fontSize: '1.125rem', opacity: 0.8 }}>
              Your AI investment assistant with full functionality
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '48rem' }}>
            {messages.map((message, i) => (
              <div key={message.id || i} style={{
                padding: '1rem',
                margin: '0.5rem 0',
                background: message.role === 'user' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'left'
              }}>
                <strong>{message.role === 'user' ? 'You' : 'Jarvis'}:</strong> {message.content}
              </div>
            ))}
            {isLoading && (
              <div style={{
                padding: '1rem',
                margin: '0.5rem 0',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'left',
                opacity: 0.7
              }}>
                <strong>Jarvis:</strong> Thinking...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced input area */}
      <div style={{ 
        padding: '1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.2)'
      }}>
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          gap: '0.5rem',
          maxWidth: '48rem',
          margin: '0 auto'
        }}>
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me about investing, DeFi, portfolio management, or market analysis... (Enter to send, Shift+Enter for new line)"
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '1rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0.5rem',
              color: 'white',
              outline: 'none',
              opacity: isLoading ? 0.7 : 1,
              resize: 'none',
              minHeight: '2.5rem',
              maxHeight: '8rem',
              fontFamily: 'inherit'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              background: isLoading || !input.trim() ? 'rgba(100,100,100,0.5)' : 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s',
              outline: 'none'
            }}
            onMouseDown={(e) => {
              if (!isLoading && input.trim()) {
                e.currentTarget.style.transform = 'scale(0.98)'
              }
            }}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
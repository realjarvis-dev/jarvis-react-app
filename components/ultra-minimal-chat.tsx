'use client'

import { useState } from 'react'

// Ultra-minimal chat with zero third-party dependencies
export function UltraMinimalChat({ id }: { id: string }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    
    setMessages(prev => [...prev, { role: 'user', content: input }])
    setInput('')
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
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem'
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
              Welcome to Jarvis
            </h1>
            <p style={{ fontSize: '1.125rem', opacity: 0.8 }}>
              Your AI investment assistant
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: '48rem' }}>
            {messages.map((message, i) => (
              <div key={i} style={{
                padding: '1rem',
                margin: '0.5rem 0',
                background: message.role === 'user' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <strong>{message.role === 'user' ? 'You' : 'Jarvis'}:</strong> {message.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ 
        padding: '1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          gap: '0.5rem',
          maxWidth: '48rem',
          margin: '0 auto'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about investing, DeFi, or portfolio management..."
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '1rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0.5rem',
              color: 'white',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'transform 0.1s',
              outline: 'none'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
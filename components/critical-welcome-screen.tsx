'use client'

import { useState } from 'react'

// Ultra-lightweight welcome screen that renders immediately for LCP
export function CriticalWelcomeScreen() {
  const [input, setInput] = useState('')

  return (
    <div 
      className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        contain: 'layout style'
      }}
    >
      {/* Critical LCP element - immediate render with inline styles */}
      <div 
        style={{
          fontSize: '1.875rem',
          fontWeight: '700',
          color: 'white',
          textAlign: 'center',
          marginBottom: '2rem',
          lineHeight: '1.2'
        }}
      >
        Welcome to Jarvis
      </div>
      
      {/* Immediate input for interaction */}
      <div style={{ width: '100%', maxWidth: '32rem', padding: '0 1rem' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            console.log('Search:', input)
          }}
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '0.5rem',
            padding: '0.5rem',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about investing..."
            style={{
              flex: '1',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '1rem',
              padding: '0.5rem'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(59, 130, 246, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
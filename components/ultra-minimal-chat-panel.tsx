'use client'

// Ultra-minimal chat panel for LCP testing - absolutely no dependencies
export function UltraMinimalChatPanel() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '1rem',
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      zIndex: 10
    }}>
      <div style={{
        maxWidth: '48rem',
        margin: '0 auto',
        display: 'flex',
        gap: '0.5rem',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '0.5rem',
        padding: '0.5rem',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <input
          type="text"
          placeholder="Ask me anything about investing..."
          style={{
            flex: 1,
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
            fontWeight: 500
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
'use client'

import { useEffect } from 'react'

interface PerformanceMonitorProps {
  type: 'before' | 'after'
}

/**
 * Component that injects performance measurement scripts
 * based on the optimization stage (before or after)
 */
export function PerformanceMonitor({ type }: PerformanceMonitorProps) {
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return

    // Create script element
    const script = document.createElement('script')
    script.src = `/performance-tests/${type}-optimization.js`
    script.async = true
    
    // Add script to document
    document.head.appendChild(script)

    // Cleanup on unmount
    return () => {
      document.head.removeChild(script)
    }
  }, [type])

  // This component doesn't render anything
  return null
}

'use client'

import { useEffect } from 'react'

export function PerformanceMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] as any
      console.log('LCP element:', lastEntry.element)
      console.log('LCP time:', lastEntry.startTime)
    })
    observer.observe({ entryTypes: ['largest-contentful-paint'] })

    const reportWebVitals = (metric: any) => {
      if (metric.label === 'web-vital') {
        console.log('Web Vital:', metric)
      }
    }

    return () => observer.disconnect()
  }, [])

  return null
}

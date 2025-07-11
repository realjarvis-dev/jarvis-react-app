import { useCallback, useEffect, useRef, useState } from 'react'

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

interface UseAutoScrollOptions {
  isLoading: boolean
  dependency: number
  isStreaming: () => boolean
  scrollContainer?: React.RefObject<HTMLElement>
  threshold?: number
  intervalMs?: number
  preventScrollOnAnnotations?: boolean
  lastMessageId?: string
}

interface UseAutoScrollReturn {
  anchorRef: React.RefObject<HTMLDivElement>
  isAutoScroll: boolean
}

/**
 * Custom hook to auto-scroll to a target element and pause when the user scrolls away.
 */
export function useAutoScroll({
  isLoading,
  dependency,
  isStreaming,
  scrollContainer,
  threshold = 70,
  intervalMs = 100,
  preventScrollOnAnnotations = false,
  lastMessageId
}: UseAutoScrollOptions): UseAutoScrollReturn {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const lastMessageIdRef = useRef<string | undefined>(lastMessageId)
  const [isAnnotationUpdate, setIsAnnotationUpdate] = useState(false)

  // Track if this is an annotation-only update
  useEffect(() => {
    if (lastMessageId && lastMessageIdRef.current === lastMessageId) {
      // Same message ID means this is likely an annotation update
      setIsAnnotationUpdate(true)
      // Reset after a short delay
      const timeout = setTimeout(() => setIsAnnotationUpdate(false), 1000)
      return () => clearTimeout(timeout)
    } else {
      // Different message ID means new message
      setIsAnnotationUpdate(false)
      lastMessageIdRef.current = lastMessageId
    }
  }, [lastMessageId])

  // Detect user scroll to toggle auto-scroll
  const handleScroll = useCallback(() => {
    if (scrollContainer?.current) {
      const element = scrollContainer.current
      const atBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight <=
        threshold
      setIsAutoScroll(atBottom)
    } else if (typeof window !== 'undefined') {
      const scrollHeight = document.documentElement.scrollHeight
      const atBottom =
        window.innerHeight + window.scrollY >= scrollHeight - threshold
      setIsAutoScroll(atBottom)
    }
  }, [threshold, scrollContainer])

  useEffect(() => {
    if (scrollContainer?.current) {
      const element = scrollContainer.current
      element.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        element.removeEventListener('scroll', handleScroll)
      }
    } else if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        window.removeEventListener('scroll', handleScroll)
      }
    }
    return undefined
  }, [handleScroll, scrollContainer])

  // Scroll to bottom using scrollHeight for more reliable behavior
  const scrollToBottom = useCallback(() => {
    if (scrollContainer?.current) {
      const element = scrollContainer.current
      element.scrollTo({
        top: element.scrollHeight,
        behavior: dependency > 5 ? 'instant' : 'smooth'
      })
    } else if (typeof window !== 'undefined') {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: dependency > 5 ? 'instant' : 'smooth'
      })
    }
  }, [dependency, scrollContainer])

  // Fallback scroll to anchor element (kept for compatibility)
  const scrollToAnchor = useCallback(() => {
    if (anchorRef.current) {
      if (scrollContainer?.current) {
        anchorRef.current.scrollIntoView({
          behavior: dependency > 5 ? 'instant' : 'smooth',
          block: 'end'
        })
      } else {
        anchorRef.current.scrollIntoView({
          behavior: dependency > 5 ? 'instant' : 'smooth'
        })
      }
    }
  }, [dependency, scrollContainer])

  // Debounced scroll to prevent rapid adjustments
  const debouncedScrollToBottom = useCallback(() => {
    const debouncedFn = debounce(scrollToBottom, 200)
    debouncedFn()
  }, [scrollToBottom])

  // Auto-scroll on updates and during streaming
  useEffect(() => {
    if (!isAutoScroll) return
    
    // Skip auto-scroll if we're preventing scroll on annotations
    if (preventScrollOnAnnotations && !isStreaming() && !isLoading) {
      return
    }
    
    // Skip auto-scroll if this is an annotation update (like related questions)
    if (isAnnotationUpdate && !isStreaming() && !isLoading) {
      return
    }
    
    // Use debounced scroll for content updates to prevent jarring movements
    // Only during non-streaming content additions (like related questions)
    if (!isStreaming() && !isLoading) {
      debouncedScrollToBottom()
    } else {
      // Use immediate scroll during active streaming for responsiveness
      scrollToBottom()
    }
    
    let intervalId: ReturnType<typeof setInterval> | undefined
    if (isAutoScroll && isStreaming() && isLoading) {
      intervalId = setInterval(scrollToBottom, intervalMs)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [
    dependency,
    isLoading,
    isAutoScroll,
    isStreaming,
    intervalMs,
    preventScrollOnAnnotations,
    isAnnotationUpdate,
    debouncedScrollToBottom,
    scrollToBottom
  ])

  return { anchorRef, isAutoScroll }
}

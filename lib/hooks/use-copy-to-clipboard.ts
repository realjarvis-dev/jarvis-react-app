'use client'

import { useEffect, useState } from 'react'

export interface useCopyToClipboardProps {
  timeout?: number
}

export function useCopyToClipboard({
  timeout = 2000
}: useCopyToClipboardProps) {
  const [isCopied, setIsCopied] = useState<Boolean>(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const copyToClipboard = async (value: string) => {
    if (!isMounted || typeof window === 'undefined' || !value) {
      return false
    }

    try {
      // Try modern clipboard API first
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        setIsCopied(true)
        setTimeout(() => {
          setIsCopied(false)
        }, timeout)
        return true
      }

      // Fallback for older browsers (including some mobile browsers)
      const textArea = document.createElement('textarea')
      textArea.value = value
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (successful) {
        setIsCopied(true)
        setTimeout(() => {
          setIsCopied(false)
        }, timeout)
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  return { isCopied, copyToClipboard }
}

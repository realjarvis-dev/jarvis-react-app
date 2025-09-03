'use client'

import { RefObject, useEffect } from 'react'
import { AutoCompleteInputRef } from './autocomplete-input'

interface MobileKeyboardHandlerProps {
  inputRef: RefObject<AutoCompleteInputRef>
}

export function useMobileKeyboardHandler({ inputRef }: MobileKeyboardHandlerProps) {
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    
    if (!isMobile) return

    let isKeyboardVisible = false
    let lastScrollTop = 0
    let preventScrollTimeout: NodeJS.Timeout | null = null

    // Store the initial scroll position
    const storeInitialScroll = () => {
      lastScrollTop = window.scrollY || document.documentElement.scrollTop
    }

    // Prevent scroll and restore position
    const handleScroll = () => {
      if (isKeyboardVisible) {
        // Immediately restore scroll position
        window.scrollTo(0, lastScrollTop)
      }
    }

    // Handle focus events on input to prevent automatic scrolling
    const handleInputFocus = (e: FocusEvent) => {
      if (e.target === inputRef.current?.getTextareaRef()) {
        storeInitialScroll()
        
        // Prevent the browser's default scroll-to-input behavior
        if (preventScrollTimeout) {
          clearTimeout(preventScrollTimeout)
        }
        
        preventScrollTimeout = setTimeout(() => {
          window.scrollTo(0, lastScrollTop)
        }, 0)
      }
    }

    // Handle Visual Viewport API
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport!.height
        const keyboardVisible = keyboardHeight > 150
        
        if (keyboardVisible !== isKeyboardVisible) {
          isKeyboardVisible = keyboardVisible
          
          if (isKeyboardVisible) {
            storeInitialScroll()
            document.body.classList.add('keyboard-visible')
            
            // Add scroll listener to prevent movement
            window.addEventListener('scroll', handleScroll, { passive: false })
            
            // Immediately restore position if it changed
            setTimeout(() => {
              window.scrollTo(0, lastScrollTop)
            }, 0)
            
          } else {
            document.body.classList.remove('keyboard-visible')
            window.removeEventListener('scroll', handleScroll)
          }
        }
      }

      window.visualViewport.addEventListener('resize', handleVisualViewportChange)
      
      // Add focus listener to input
      document.addEventListener('focusin', handleInputFocus)
      
      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange)
        document.removeEventListener('focusin', handleInputFocus)
        window.removeEventListener('scroll', handleScroll)
        document.body.classList.remove('keyboard-visible')
        if (preventScrollTimeout) {
          clearTimeout(preventScrollTimeout)
        }
      }
    } else {
      // Fallback for older browsers
      let initialViewportHeight = window.innerHeight

      const handleViewportChange = () => {
        const currentHeight = window.innerHeight
        const heightDifference = initialViewportHeight - currentHeight
        const keyboardVisible = heightDifference > 150
        
        if (keyboardVisible !== isKeyboardVisible) {
          isKeyboardVisible = keyboardVisible
          
          if (isKeyboardVisible) {
            storeInitialScroll()
            document.body.classList.add('keyboard-visible')
            window.addEventListener('scroll', handleScroll, { passive: false })
            
            setTimeout(() => {
              window.scrollTo(0, lastScrollTop)
            }, 0)
          } else {
            document.body.classList.remove('keyboard-visible')
            window.removeEventListener('scroll', handleScroll)
          }
        }
      }

      window.addEventListener('resize', handleViewportChange)
      document.addEventListener('focusin', handleInputFocus)
      
      return () => {
        window.removeEventListener('resize', handleViewportChange)
        document.removeEventListener('focusin', handleInputFocus)
        window.removeEventListener('scroll', handleScroll)
        document.body.classList.remove('keyboard-visible')
        if (preventScrollTimeout) {
          clearTimeout(preventScrollTimeout)
        }
      }
    }
  }, [inputRef])
}

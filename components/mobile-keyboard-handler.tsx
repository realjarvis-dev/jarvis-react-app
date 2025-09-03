'use client'

import { RefObject, useEffect } from 'react'
import { AutoCompleteInputRef } from './autocomplete-input'

interface MobileKeyboardHandlerProps {
  inputRef: RefObject<AutoCompleteInputRef>
}

export function useMobileKeyboardHandler({ inputRef }: MobileKeyboardHandlerProps) {
  useEffect(() => {
    // Only run on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    
    if (!isMobile) return

    let isKeyboardVisible = false
    let originalScrollTop = 0

    // Store original scroll position when keyboard opens
    const storeScrollPosition = () => {
      originalScrollTop = window.scrollY || document.documentElement.scrollTop
    }

    // Prevent scroll when keyboard is visible
    const preventScroll = (e: Event) => {
      if (isKeyboardVisible) {
        e.preventDefault()
        window.scrollTo(0, originalScrollTop)
      }
    }

    // Handle Visual Viewport API (iOS Safari, modern browsers)
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport!.height
        const keyboardVisible = keyboardHeight > 150
        
        if (keyboardVisible !== isKeyboardVisible) {
          isKeyboardVisible = keyboardVisible
          
          if (isKeyboardVisible) {
            // Keyboard is opening
            storeScrollPosition()
            document.body.classList.add('keyboard-visible')
            
            // Prevent any scrolling
            document.addEventListener('scroll', preventScroll, { passive: false })
            document.addEventListener('touchmove', preventScroll, { passive: false })
            
            // Lock the scroll position
            document.body.style.position = 'fixed'
            document.body.style.top = `-${originalScrollTop}px`
            document.body.style.width = '100%'
            
          } else {
            // Keyboard is closing
            document.body.classList.remove('keyboard-visible')
            
            // Remove scroll prevention
            document.removeEventListener('scroll', preventScroll)
            document.removeEventListener('touchmove', preventScroll)
            
            // Restore scroll position
            document.body.style.position = ''
            document.body.style.top = ''
            document.body.style.width = ''
            window.scrollTo(0, originalScrollTop)
          }
        }
      }

      window.visualViewport.addEventListener('resize', handleVisualViewportChange)
      
      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange)
        document.removeEventListener('scroll', preventScroll)
        document.removeEventListener('touchmove', preventScroll)
        
        // Clean up any applied styles
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.classList.remove('keyboard-visible')
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
            storeScrollPosition()
            document.body.classList.add('keyboard-visible')
            
            // Prevent scrolling
            document.addEventListener('scroll', preventScroll, { passive: false })
            document.addEventListener('touchmove', preventScroll, { passive: false })
            
            // Lock scroll position
            document.body.style.position = 'fixed'
            document.body.style.top = `-${originalScrollTop}px`
            document.body.style.width = '100%'
            
          } else {
            document.body.classList.remove('keyboard-visible')
            
            // Remove scroll prevention
            document.removeEventListener('scroll', preventScroll)
            document.removeEventListener('touchmove', preventScroll)
            
            // Restore scroll position
            document.body.style.position = ''
            document.body.style.top = ''
            document.body.style.width = ''
            window.scrollTo(0, originalScrollTop)
          }
        }
      }

      window.addEventListener('resize', handleViewportChange)
      
      return () => {
        window.removeEventListener('resize', handleViewportChange)
        document.removeEventListener('scroll', preventScroll)
        document.removeEventListener('touchmove', preventScroll)
        
        // Clean up any applied styles
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.classList.remove('keyboard-visible')
      }
    }
  }, [inputRef])
}

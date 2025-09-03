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

    // Simple approach - just detect keyboard and add class for CSS to handle
    let isKeyboardVisible = false

    // Handle Visual Viewport API (iOS Safari, modern browsers)
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport!.height
        const keyboardVisible = keyboardHeight > 150
        
        if (keyboardVisible !== isKeyboardVisible) {
          isKeyboardVisible = keyboardVisible
          
          if (isKeyboardVisible) {
            document.body.classList.add('keyboard-visible')
          } else {
            document.body.classList.remove('keyboard-visible')
          }
        }
      }

      window.visualViewport.addEventListener('resize', handleVisualViewportChange)
      
      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange)
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
            document.body.classList.add('keyboard-visible')
          } else {
            document.body.classList.remove('keyboard-visible')
          }
        }
      }

      window.addEventListener('resize', handleViewportChange)
      
      return () => {
        window.removeEventListener('resize', handleViewportChange)
        document.body.classList.remove('keyboard-visible')
      }
    }
  }, [inputRef])
}

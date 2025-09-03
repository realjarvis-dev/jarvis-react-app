'use client'

import { RefObject, useEffect } from 'react'
import { AutoCompleteInputRef } from './autocomplete-input'

interface MobileKeyboardHandlerProps {
  inputRef: RefObject<AutoCompleteInputRef>
}

export function useMobileKeyboardHandler({ inputRef }: MobileKeyboardHandlerProps) {
  useEffect(() => {
    // Run on iOS and Android devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)
    const isMobile = isIOS || isAndroid
    
    if (!isMobile) return

    let initialViewportHeight = window.visualViewport?.height || window.innerHeight
    let isKeyboardVisible = false

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height
        const heightDifference = initialViewportHeight - currentHeight
        
        if (heightDifference > 150) { // Keyboard likely open
          if (!isKeyboardVisible) {
            isKeyboardVisible = true
            document.body.classList.add('keyboard-visible')
          }
        } else { // Keyboard likely closed
          if (isKeyboardVisible) {
            isKeyboardVisible = false
            document.body.classList.remove('keyboard-visible')
          }
        }
      }
    }

    const handleFocusIn = () => {
      // Small delay to allow keyboard animation
      setTimeout(() => {
        if (window.visualViewport) {
          handleViewportChange()
        }
      }, 300)
    }

    const handleFocusOut = () => {
      setTimeout(() => {
        if (isKeyboardVisible) {
          isKeyboardVisible = false
          document.body.classList.remove('keyboard-visible')
        }
      }, 300)
    }

    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
    }

    // Fallback for older browsers and additional reliability
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
      }
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [inputRef])
}

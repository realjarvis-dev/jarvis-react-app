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

    // Handle Visual Viewport API (iOS Safari, modern browsers)
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport!.height
        const keyboardVisible = keyboardHeight > 150
        
        if (keyboardVisible !== isKeyboardVisible) {
          isKeyboardVisible = keyboardVisible
          
          if (isKeyboardVisible) {
            // Keyboard is opening - just add class, no position changes
            document.body.classList.add('keyboard-visible')
            
            // Set CSS custom property for keyboard height
            document.documentElement.style.setProperty(
              '--keyboard-height',
              `${keyboardHeight}px`
            )
            
          } else {
            // Keyboard is closing
            document.body.classList.remove('keyboard-visible')
            
            // Reset keyboard height
            document.documentElement.style.setProperty('--keyboard-height', '0px')
          }
        }
      }

      window.visualViewport.addEventListener('resize', handleVisualViewportChange)
      
      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange)
        document.body.classList.remove('keyboard-visible')
        document.documentElement.style.setProperty('--keyboard-height', '0px')
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
            document.documentElement.style.setProperty(
              '--keyboard-height',
              `${heightDifference}px`
            )
          } else {
            document.body.classList.remove('keyboard-visible')
            document.documentElement.style.setProperty('--keyboard-height', '0px')
          }
        }
      }

      window.addEventListener('resize', handleViewportChange)
      
      return () => {
        window.removeEventListener('resize', handleViewportChange)
        document.body.classList.remove('keyboard-visible')
        document.documentElement.style.setProperty('--keyboard-height', '0px')
      }
    }
  }, [inputRef])
}

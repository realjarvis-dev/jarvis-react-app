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

    const checkInputContent = () => {
      const textarea = inputRef.current?.getTextareaRef()
      if (textarea) {
        if (textarea.value.trim().length > 0) {
          document.body.classList.add('keyboard-visible-typing')
        } else {
          document.body.classList.remove('keyboard-visible-typing')
        }
      }
    }

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height
        const heightDifference = initialViewportHeight - currentHeight
        
        if (heightDifference > 150) { // Keyboard likely open
          if (!isKeyboardVisible) {
            isKeyboardVisible = true
            document.body.classList.add('keyboard-visible')
            checkInputContent()
          }
        } else { // Keyboard likely closed
          if (isKeyboardVisible) {
            isKeyboardVisible = false
            document.body.classList.remove('keyboard-visible')
            document.body.classList.remove('keyboard-visible-typing')
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
          document.body.classList.remove('keyboard-visible-typing')
        }
      }, 300)
    }

    const handleFormSubmit = () => {
      // When form is submitted (generating response), remove keyboard classes
      // This will return input to bottom position
      setTimeout(() => {
        document.body.classList.remove('keyboard-visible')
        document.body.classList.remove('keyboard-visible-typing')
        isKeyboardVisible = false
      }, 100)
    }

    const handleInput = () => {
      if (isKeyboardVisible) {
        checkInputContent()
      }
    }

    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
    }

    // Fallback for older browsers and additional reliability
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    
    // Listen for input changes to detect typing
    const textarea = inputRef.current?.getTextareaRef()
    if (textarea) {
      textarea.addEventListener('input', handleInput)
    }

    // Listen for form submission to return input to bottom
    const form = textarea?.closest('form')
    if (form) {
      form.addEventListener('submit', handleFormSubmit)
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
      }
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      
      const textarea = inputRef.current?.getTextareaRef()
      if (textarea) {
        textarea.removeEventListener('input', handleInput)
      }

      const form = textarea?.closest('form')
      if (form) {
        form.removeEventListener('submit', handleFormSubmit)
      }
    }
  }, [inputRef])
}

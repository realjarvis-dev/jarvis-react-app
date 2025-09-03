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

    let initialViewportHeight = window.innerHeight
    let isKeyboardVisible = false

    const handleViewportChange = () => {
      const currentHeight = window.innerHeight
      const heightDifference = initialViewportHeight - currentHeight

      // Keyboard is considered visible if viewport height decreased by more than 150px
      const keyboardVisible = heightDifference > 150

      if (keyboardVisible !== isKeyboardVisible) {
        isKeyboardVisible = keyboardVisible

        if (isKeyboardVisible) {
          // Keyboard is opening
          document.body.classList.add('keyboard-visible')

          // Scroll the input into view after a short delay
          setTimeout(() => {
            const textarea = inputRef.current?.getTextareaRef()
            if (textarea) {
              textarea.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              })
            }
          }, 300)
        } else {
          // Keyboard is closing
          document.body.classList.remove('keyboard-visible')
        }
      }
    }

    // Use Visual Viewport API if available (iOS Safari, modern browsers)
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const keyboardHeight = window.innerHeight - window.visualViewport!.height
        const keyboardVisible = keyboardHeight > 150

        if (keyboardVisible !== isKeyboardVisible) {
          isKeyboardVisible = keyboardVisible

          if (isKeyboardVisible) {
            document.body.classList.add('keyboard-visible')

            // Ensure input stays visible
            setTimeout(() => {
              const textarea = inputRef.current?.getTextareaRef()
              if (textarea) {
                const rect = textarea.getBoundingClientRect()
                const viewportHeight = window.visualViewport!.height

                // If input is below the visible area, scroll it into view
                if (rect.bottom > viewportHeight) {
                  textarea.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                  })
                }
              }
            }, 100)
          } else {
            document.body.classList.remove('keyboard-visible')
          }
        }
      }

      window.visualViewport.addEventListener('resize', handleVisualViewportChange)

      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange)
      }
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleViewportChange)

      return () => {
        window.removeEventListener('resize', handleViewportChange)
      }
    }
  }, [inputRef])
}

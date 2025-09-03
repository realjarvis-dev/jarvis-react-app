'use client'

import { RefObject, useEffect } from 'react'
import { AutoCompleteInputRef } from './autocomplete-input'

interface MobileKeyboardHandlerProps {
  inputRef: RefObject<AutoCompleteInputRef>
}

export function useMobileKeyboardHandler({ inputRef }: MobileKeyboardHandlerProps) {
  useEffect(() => {
    // Actually, let's not interfere at all and let the browser handle it naturally
    // The CSS sticky positioning should be enough
    
    // Only add a simple class for potential CSS styling if needed
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    
    if (isMobile) {
      document.body.classList.add('mobile-device')
    }

    return () => {
      document.body.classList.remove('mobile-device')
      document.body.classList.remove('keyboard-visible')
    }
  }, [inputRef])
}

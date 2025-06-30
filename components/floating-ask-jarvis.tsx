'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { MessageSquare } from 'lucide-react'

interface FloatingAskJarvisProps {
  onAskJarvis: (selectedText: string) => void
}

export function FloatingAskJarvis({ onAskJarvis }: FloatingAskJarvisProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleSelection = (event?: MouseEvent) => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      
      if (text && text.length > 0) {
        setSelectedText(text)
        
        // Get selection position
        const range = selection?.getRangeAt(0)
        if (range) {
          const rect = range.getBoundingClientRect()
          // Position the button very close to mouse cursor, just slightly above
          setPosition({
            x: event?.clientX || rect.left + rect.width / 2,
            y: (event?.clientY || rect.top) - 15
          })
          setIsVisible(true)
        }
      } else {
        setIsVisible(false)
        setSelectedText('')
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        // Check if click is not on selected text
        const selection = window.getSelection()
        if (!selection || selection.toString().trim().length === 0) {
          setIsVisible(false)
          setSelectedText('')
        }
      }
    }

    // Listen for text selection
    document.addEventListener('mouseup', handleSelection)
    document.addEventListener('keyup', () => handleSelection())
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mouseup', handleSelection)
      document.removeEventListener('keyup', () => handleSelection())
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleAskJarvis = () => {
    if (selectedText) {
      onAskJarvis(selectedText)
      setIsVisible(false)
      setSelectedText('')
      // Clear selection
      window.getSelection()?.removeAllRanges()
    }
  }

  if (!isVisible || !selectedText) {
    return null
  }

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <div className="pointer-events-auto bg-black/30 backdrop-blur-sm border border-emerald-500/30 rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-200">
        <Button
          ref={buttonRef}
          onClick={handleAskJarvis}
          size="sm"
          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-0 h-8 px-3 text-xs font-medium transition-colors duration-200"
        >
          <MessageSquare className="w-3 h-3 mr-1.5" />
          Ask Jarvis
        </Button>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Textarea } from '@/components/ui/textarea'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createSuggestionEngine, SuggestionEngine, Suggestion, SuggestionContext } from '@/lib/utils/suggestion-engine'
import { useNetwork } from '@/lib/network/context'
import { cn } from '@/lib/utils'
import * as Icons from 'lucide-react'

interface AutoCompleteInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onCompositionStart?: () => void
  onCompositionEnd?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  rows?: number
}

export interface AutoCompleteInputRef {
  focus: () => void
  blur: () => void
  getTextareaRef: () => HTMLTextAreaElement | null
}

export const AutoCompleteInput = forwardRef<AutoCompleteInputRef, AutoCompleteInputProps>(
  ({ 
    value, 
    onChange, 
    onKeyDown, 
    onCompositionStart, 
    onCompositionEnd,
    placeholder,
    className,
    disabled,
    autoFocus,
    rows = 1
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [cursorPosition, setCursorPosition] = useState(0)
    const [isComposing, setIsComposing] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const suggestionEngine = useRef<SuggestionEngine | null>(null)
    const networkContext = useNetwork()
    
    // Initialize suggestion engine on client side only
    useEffect(() => {
      setIsMounted(true)
      suggestionEngine.current = createSuggestionEngine()
      console.log('🚀 AutoCompleteInput component mounted!', { value, disabled, isMounted })
    }, [])
    
    // Debug log on every render
    console.log('🔄 AutoCompleteInput render:', { value, isMounted, isOpen, suggestionsCount: suggestions.length, suggestions: suggestions.map(s => s.text) })
    
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      getTextareaRef: () => textareaRef.current
    }))

    // Generate suggestions when input changes
    useEffect(() => {
      const generateSuggestions = async () => {
        if (!isMounted || !suggestionEngine.current || isComposing || disabled) {
          console.log('⚠️ Early return from generateSuggestions:', { isMounted, hasEngine: !!suggestionEngine.current, isComposing, disabled })
          return
        }
        
        const context: SuggestionContext = {
          networkContext: {
            selectedNetwork: networkContext?.isDemoMode ? 'demo' : networkContext?.selectedChain || 'ethereum',
            selectedChainId: parseInt(networkContext?.activeNetwork?.id?.toString() || '1'),
            isDemo: networkContext?.isDemoMode || false,
            rpcUrl: networkContext?.activeNetwork?.rpcUrl || '',
            config: networkContext?.activeNetwork || {} as any
          },
          userInput: value,
          cursorPosition,
          isDemo: networkContext?.isDemoMode
        }
        
        console.log('🌐 Network context for suggestions:', context.networkContext)

        try {
          console.log('🔍 Generating suggestions for:', value, 'context:', context)
          const newSuggestions = await suggestionEngine.current.generateSuggestions(context)
          console.log('✅ Generated suggestions:', newSuggestions)
          setSuggestions(newSuggestions)
          const shouldOpen = newSuggestions.length > 0 && value.trim().length > 0
          console.log('🎨 Setting isOpen to:', shouldOpen, 'suggestions count:', newSuggestions.length, 'value length:', value.trim().length)
          setIsOpen(shouldOpen)
          
          setSelectedIndex(-1)
        } catch (error) {
          console.error('❌ Failed to generate suggestions:', error)
          setSuggestions([])
          setIsOpen(false)
        }
      }

      const debounceTimer = setTimeout(generateSuggestions, 150)
      return () => clearTimeout(debounceTimer)
    }, [value, cursorPosition, isComposing, disabled, networkContext, isMounted]) // eslint-disable-line react-hooks/exhaustive-deps

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposing) {
        onKeyDown?.(e)
        return
      }

      if (isOpen && suggestions.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setSelectedIndex(prev => 
              prev < suggestions.length - 1 ? prev + 1 : 0
            )
            return
          case 'ArrowUp':
            e.preventDefault()
            setSelectedIndex(prev => 
              prev > 0 ? prev - 1 : suggestions.length - 1
            )
            return
          case 'Tab':
          case 'Enter':
            if (selectedIndex >= 0) {
              e.preventDefault()
              applySuggestion(suggestions[selectedIndex])
              return
            }
            break
          case 'Escape':
            e.preventDefault()
            setIsOpen(false)
            setSelectedIndex(-1)
            return
        }
      }

      // Update cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          setCursorPosition(textareaRef.current.selectionStart || 0)
        }
      }, 0)

      onKeyDown?.(e)
    }

    // Apply selected suggestion
    const applySuggestion = (suggestion: Suggestion) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const currentValue = value
      const start = textarea.selectionStart || 0
      const end = textarea.selectionEnd || 0

      // Find the word boundary to replace
      const beforeCursor = currentValue.slice(0, start)
      const afterCursor = currentValue.slice(end)
      
      // Find the start of the current word
      const words = beforeCursor.split(/\s+/)
      const currentWord = words[words.length - 1] || ''
      const wordStart = beforeCursor.lastIndexOf(currentWord)
      
      // Replace the current word with the suggestion
      const newValue = 
        currentValue.slice(0, wordStart) + 
        suggestion.text + 
        afterCursor

      onChange(newValue)
      setIsOpen(false)
      setSelectedIndex(-1)

      // Set cursor position after the inserted text
      setTimeout(() => {
        const newCursorPos = wordStart + suggestion.text.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
      }, 0)
    }

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      console.log('📝 AutoCompleteInput handleInputChange called with:', newValue)
      onChange(newValue)
      setCursorPosition(e.target.selectionStart || 0)
    }

    // Handle composition events
    const handleCompositionStart = () => {
      setIsComposing(true)
      onCompositionStart?.()
    }

    const handleCompositionEnd = () => {
      setIsComposing(false)
      onCompositionEnd?.()
    }

    // Get icon component
    const getIcon = (iconName: string) => {
      const IconComponent = (Icons as any)[iconName]
      return IconComponent ? <IconComponent className="h-4 w-4" /> : null
    }

    // Render simple textarea on server, full component on client
    if (!isMounted) {
      return (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            console.log('📝 SSR handleInputChange called with:', e.target.value)
            onChange(e.target.value)
          }}
          onKeyDown={onKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          placeholder={placeholder}
          className={cn(
            "resize-none border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0",
            className
          )}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={rows}
        />
      )
    }

    console.log('🎭 Popover render state:', { isOpen, suggestionsLength: suggestions.length, value })
    
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              className={cn(
                "resize-none border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0",
                className
              )}
              disabled={disabled}
              autoFocus={autoFocus}
              rows={rows}
            />
          </div>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-80 p-0 z-[100]" 
          align="start"
          side="bottom"
          sideOffset={8}
        >
          <Command className="border-0">
            <CommandList>
              <CommandEmpty>No suggestions found.</CommandEmpty>
              
              {suggestions.length > 0 && (
                <CommandGroup>
                  {suggestions.map((suggestion, index) => (
                    <CommandItem
                      key={suggestion.id}
                      value={suggestion.text}
                      onSelect={() => applySuggestion(suggestion)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 cursor-pointer",
                        index === selectedIndex && "bg-accent text-accent-foreground"
                      )}
                    >
                      {suggestion.icon && getIcon(suggestion.icon)}
                      <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                        <div className="font-medium text-sm truncate w-full">
                          {suggestion.text}
                        </div>
                        <div className="text-xs text-muted-foreground truncate w-full">
                          {suggestion.description}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-muted rounded">
                        {suggestion.category}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }
)

AutoCompleteInput.displayName = 'AutoCompleteInput'
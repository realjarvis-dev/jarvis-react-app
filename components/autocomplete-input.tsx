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
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [cursorPosition, setCursorPosition] = useState(0)
    const [isComposing, setIsComposing] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const suggestionEngine = useRef<any>(null)
    const networkContext = useNetwork()
    
    
    // Initialize suggestion engine on client side only
    useEffect(() => {
      setIsMounted(true)
      // Use client-safe suggestion engine
      import('@/lib/utils/client-suggestion-engine').then((module) => {
        suggestionEngine.current = module.createClientSuggestionEngine()
      }).catch((error) => {
        console.error('Failed to load client suggestion engine:', error)
      })
    }, [])
    
    
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      getTextareaRef: () => textareaRef.current
    }))

    // Generate suggestions when input changes
    useEffect(() => {
      if (!isMounted || !networkContext) {
        return
      }

      const generateSuggestions = async () => {
        try {
          let newSuggestions: any[] = []

          // Check if user has already provided a complete query
          const input = value.toLowerCase().trim()
          const isCompleteQuery = input.length > 10 && (
            input.includes('check') && input.includes('balance') ||
            input.includes('swap') && input.includes('for') ||
            input.includes('find') && input.includes('opportunities') ||
            input.includes('get') && input.includes('price') ||
            input.includes('compare') && input.includes('returns') ||
            input.split(' ').length >= 4 // 4+ words likely indicates a complete query
          )

          // Don't show suggestions if user has a complete query
          if (isCompleteQuery) {
            setSuggestions([])
            setIsOpen(false)
            setSelectedIndex(-1)
            return
          }

          // Try to use the sophisticated suggestion engine if available
          if (suggestionEngine.current) {
            const context = {
              selectedNetwork: networkContext.selectedChain,
              isDemoMode: networkContext.isDemoMode,
              userInput: value,
              cursorPosition
            }

            newSuggestions = await suggestionEngine.current.generateSuggestions(context)
          } else {
            // Fallback to simple inline suggestions
            if (input && input.length <= 10) { // Only suggest for short inputs
              // Simple pattern matching for common crypto actions
              if (input.includes('check') || input.includes('balance')) {
                newSuggestions.push({
                  id: 'check-balance',
                  text: 'Check my wallet balance',
                  description: 'View your current token balances',
                  category: 'command',
                  icon: 'Wallet',
                  score: 100
                })
              }
              
              if (input.includes('swap') || input.startsWith('sw')) {
                newSuggestions.push({
                  id: 'swap-tokens',
                  text: 'Swap tokens',
                  description: 'Exchange one token for another',
                  category: 'command',
                  icon: 'ArrowRightLeft',
                  score: 95
                })
              }
              
              if (input.includes('gas') || input.includes('fee')) {
                newSuggestions.push({
                  id: 'gas-price',
                  text: 'Check gas price',
                  description: 'Get current network gas prices',
                  category: 'command',
                  icon: 'Fuel',
                  score: 90
                })
              }
              
              if (input.includes('pendle') || input.includes('yield')) {
                newSuggestions.push({
                  id: 'pendle-opportunities',
                  text: 'Find Pendle opportunities',
                  description: 'Discover yield farming opportunities',
                  category: 'command',
                  icon: 'TrendingUp',
                  score: 85
                })
              }
              
              // Token suggestions
              const tokens = ['ETH', 'USDC', 'USDT', 'DAI', 'PENDLE', 'AAVE', 'UNI']
              tokens.forEach((token, index) => {
                if (token.toLowerCase().includes(input) || input.includes(token.toLowerCase())) {
                  newSuggestions.push({
                    id: `token-${token}`,
                    text: token,
                    description: `${token} token`,
                    category: 'token',
                    icon: 'Coins',
                    score: 70 - index
                  })
                }
              })

              // Sort by score and take top 6
              newSuggestions = newSuggestions
                .sort((a, b) => b.score - a.score)
                .slice(0, 6)
            }
          }
            
          setSuggestions(newSuggestions)
          
          // Only show popover if we have suggestions and user is typing a short query
          // Never show popover with "No suggestions found" - just hide it completely
          if (newSuggestions.length > 0 && value.trim().length > 0 && value.trim().length <= 15) {
            setIsOpen(true)
            setSelectedIndex(0) // Auto-select first suggestion
          } else {
            setIsOpen(false)
            setSelectedIndex(-1)
          }
        } catch (error) {
          console.error('Error generating suggestions:', error)
          setSuggestions([])
          setIsOpen(false)
        }
      }

      // Debounce suggestions generation
      const timeoutId = setTimeout(generateSuggestions, 150)
      return () => clearTimeout(timeoutId)
    }, [value, isMounted, networkContext, cursorPosition, suggestionEngine.current])

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
    const applySuggestion = (suggestion: any) => {
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

    // Always render the same structure to avoid hydration mismatch
    // Just disable suggestions on server side
    const shouldShowPopover = isMounted && isOpen

    
    return (
      <Popover open={shouldShowPopover} onOpenChange={setIsOpen}>
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
        
        {shouldShowPopover && suggestions.length > 0 && (
          <PopoverContent 
            className="w-80 p-0 z-[9999]" 
            align="start"
            side="bottom"
            sideOffset={8}
            style={{ zIndex: 9999 }}
          >
            <Command className="border-0">
              <CommandList>
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
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    )
  }
)

AutoCompleteInput.displayName = 'AutoCompleteInput'
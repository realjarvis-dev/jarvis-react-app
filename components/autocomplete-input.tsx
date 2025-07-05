'use client'

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useNetwork } from '@/lib/network/context'
import { cn } from '@/lib/utils'
import * as Icons from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

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
    const [isTyping, setIsTyping] = useState(false)
    
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const suggestionEngine = useRef<any>(null)
    const networkContext = useNetwork()
    const typingTimeoutRef = useRef<NodeJS.Timeout>()
    const suggestionTimeoutRef = useRef<NodeJS.Timeout>()
    
    
    // Initialize suggestion engine on client side only
    useEffect(() => {
      setIsMounted(true)
      // Use client-safe suggestion engine
      import('@/lib/utils/client-suggestion-engine').then((module) => {
        suggestionEngine.current = module.createClientSuggestionEngine()
      }).catch((error) => {
        console.error('Failed to load client suggestion engine:', error)
      })
      
      // Cleanup function to clear timeouts
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        if (suggestionTimeoutRef.current) {
          clearTimeout(suggestionTimeoutRef.current)
        }
      }
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

      // Clear previous suggestion timeout
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current)
      }

      const generateSuggestions = async () => {
        try {
          let newSuggestions: any[] = []

          // Always show suggestions - remove blocking logic
          const input = value.toLowerCase().trim()
          
          // Only skip suggestions if input is completely empty
          if (!input) {
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
            // Fallback to simple inline suggestions - always show for any input length
            if (input) {
              // Enhanced contextual pattern matching
              const hasBalance = input.includes('check') || input.includes('balance')
              const hasSwap = input.includes('swap') || input.startsWith('sw')
              const hasGas = input.includes('gas') || input.includes('fee')
              const hasPendle = input.includes('pendle') || input.includes('yield')
              
              // Contextual suggestions based on what's already in the prompt
              if (hasBalance && !hasSwap) {
                newSuggestions.push({
                  id: 'then-swap',
                  text: 'and then swap some ETH for USDC',
                  description: 'Follow up with a token swap',
                  category: 'command',
                  icon: 'ArrowRightLeft',
                  score: 100
                })
              }
              
              if (hasSwap && !hasPendle) {
                newSuggestions.push({
                  id: 'then-opportunities',
                  text: 'and find yield opportunities',
                  description: 'Look for earning opportunities',
                  category: 'command',
                  icon: 'TrendingUp',
                  score: 100
                })
              }
              
              if ((hasBalance || hasSwap) && !hasGas) {
                newSuggestions.push({
                  id: 'check-gas',
                  text: 'and check current gas prices',
                  description: 'Get network fee information',
                  category: 'command',
                  icon: 'Fuel',
                  score: 95
                })
              }
              
              // Basic action suggestions
              if (input.includes('check') || input.includes('balance')) {
                newSuggestions.push({
                  id: 'check-balance',
                  text: 'Check my wallet balance',
                  description: 'View your current token balances',
                  category: 'command',
                  icon: 'Wallet',
                  score: 90
                })
              }
              
              if (input.includes('swap') || input.startsWith('sw')) {
                newSuggestions.push({
                  id: 'swap-tokens',
                  text: 'Swap tokens',
                  description: 'Exchange one token for another',
                  category: 'command',
                  icon: 'ArrowRightLeft',
                  score: 85
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
            
          // Filter out suggestions that exactly match the current input
          const filteredSuggestions = newSuggestions.filter(suggestion => {
            const currentInput = value.trim().toLowerCase()
            const suggestionText = suggestion.text.toLowerCase()
            
            // Don't show suggestion if it exactly matches current input
            if (currentInput === suggestionText) {
              return false
            }
            
            // Don't show suggestion if current input is longer and contains the suggestion
            if (currentInput.length > suggestionText.length && currentInput.includes(suggestionText)) {
              return false
            }
            
            return true
          })
          
          setSuggestions(filteredSuggestions)
          
          // Always show popover when there's input and suggestions available
          // This provides consistent UX and users feel autocomplete is always available
          if (value.trim().length > 0 && filteredSuggestions.length > 0) {
            setIsOpen(true)
            setSelectedIndex(-1) // Don't auto-select to avoid blocking typing
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

      // Generate suggestions in real-time as user types
      // Use minimal delay to keep it responsive but not overwhelming
      if (value.trim().length > 0) {
        suggestionTimeoutRef.current = setTimeout(generateSuggestions, 50)
      } else {
        // Hide suggestions only when input is empty
        setIsOpen(false)
        setSelectedIndex(-1)
        setSuggestions([])
      }

      return () => {
        if (suggestionTimeoutRef.current) {
          clearTimeout(suggestionTimeoutRef.current)
        }
      }
    }, [value, isMounted, networkContext, cursorPosition])

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
              prev === -1 ? 0 : (prev < suggestions.length - 1 ? prev + 1 : 0)
            )
            return
          case 'ArrowUp':
            e.preventDefault()
            setSelectedIndex(prev => 
              prev === -1 ? suggestions.length - 1 : (prev > 0 ? prev - 1 : suggestions.length - 1)
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
      
      // Only reset selection, keep suggestions available for continuous editing
      setSelectedIndex(-1)
      
      // Set cursor position after the inserted text
      setTimeout(() => {
        const newCursorPos = wordStart + suggestion.text.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
        
        // Allow immediate re-generation of suggestions for continuous context
        setIsTyping(false)
      }, 0)
    }

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      onChange(newValue)
      setCursorPosition(e.target.selectionStart || 0)
      
      // Set typing state to true when user types
      setIsTyping(true)
      
      // Clear previous typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Set typing to false after user stops typing for 50ms (faster response)
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
      }, 50)
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
    // Always show popover when open to make autocomplete feel always-on
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
                "resize-none !border-0 bg-transparent px-0 py-0 text-base shadow-none !focus-visible:ring-0 !outline-none !focus:outline-none !ring-0 !ring-offset-0 !focus-visible:ring-offset-0",
                className
              )}
              disabled={disabled}
              autoFocus={autoFocus}
              rows={rows}
            />
          </div>
        </PopoverTrigger>
        
        {shouldShowPopover && (
          <PopoverContent 
            className="w-80 p-0 bg-background/95 backdrop-blur-sm rounded-md overflow-hidden border-0" 
            align="start"
            side="bottom"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <Command className="border-0 bg-transparent">
              <CommandList className="max-h-[200px] overflow-y-auto">
                {suggestions.length > 0 ? (
                  <CommandGroup className="p-0">
                    {suggestions.map((suggestion, index) => (
                      <CommandItem
                        key={suggestion.id}
                        value={suggestion.text}
                        onSelect={() => applySuggestion(suggestion)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 cursor-pointer border-0 hover:bg-accent hover:text-accent-foreground",
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
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                    Continue typing for suggestions...
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    )
  }
)

AutoCompleteInput.displayName = 'AutoCompleteInput'
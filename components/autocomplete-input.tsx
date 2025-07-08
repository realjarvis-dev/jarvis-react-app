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

// Compare two suggestion arrays for equality
const areSuggestionsEqual = (suggestions1: any[], suggestions2: any[]): boolean => {
  if (suggestions1.length !== suggestions2.length) return false
  
  return suggestions1.every((suggestion1, index) => {
    const suggestion2 = suggestions2[index]
    return suggestion1.id === suggestion2.id &&
           suggestion1.text === suggestion2.text &&
           suggestion1.description === suggestion2.description &&
           suggestion1.category === suggestion2.category &&
           suggestion1.icon === suggestion2.icon
  })
}

// Calculate relevance score based on user input
const calculateRelevanceScore = (suggestionText: string, userInput: string, currentWord: string): number => {
  let score = 0
  const suggestion = suggestionText.toLowerCase()
  const input = userInput.toLowerCase()
  const word = currentWord.toLowerCase()
  
  // Exact match with current word gets highest score
  if (suggestion.includes(word) && word.length > 1) {
    score += 100
    // Bonus if it starts with the current word
    if (suggestion.startsWith(word)) {
      score += 50
    }
  }
  
  // Check for partial matches in suggestion text
  const suggestionWords = suggestion.split(' ')
  const inputWords = input.split(' ')
  
  suggestionWords.forEach(suggWord => {
    if (word && suggWord.startsWith(word)) {
      score += 75
    }
    inputWords.forEach(inputWord => {
      if (inputWord.length > 2 && suggWord.includes(inputWord)) {
        score += 25
      }
    })
  })
  
  return score
}

// Network-aware suggestion helper
const getNetworkAwareSuggestions = (input: string, network: string, currentWord: string) => {
  const suggestions: any[] = []
  
  // Network-specific protocols and opportunities
  const networkProtocols = {
    'ethereum': ['Uniswap', 'Aave', 'Compound', 'MakerDAO', 'Pendle', 'Lido'],
    'arbitrum': ['GMX', 'Camelot', 'Radiant', 'Pendle', 'Uniswap V3'],
    'base': ['Aerodrome', 'Baseswap', 'Seamless', 'Pendle'],
    'polygon': ['Quickswap', 'Aave', 'Pendle', 'Balancer'],
    'optimism': ['Velodrome', 'Aave', 'Pendle', 'Uniswap V3']
  }
  
  const currentProtocols = networkProtocols[network?.toLowerCase() as keyof typeof networkProtocols] || networkProtocols.ethereum
  
  // Context-aware suggestions based on input
  if (input.includes('find') || input.includes('discover') || input.includes('explore')) {
    currentProtocols.forEach((protocol, index) => {
      const suggestionText = `Find ${protocol} opportunities`
      const baseScore = 100 - index
      const relevanceScore = calculateRelevanceScore(suggestionText, input, currentWord)
      
      suggestions.push({
        id: `find-${protocol.toLowerCase()}`,
        text: suggestionText,
        description: `Discover ${protocol} yield farming and trading opportunities`,
        category: 'command',
        icon: 'TrendingUp',
        score: baseScore + relevanceScore
      })
    })
  }
  
  if (input.includes('yield') || input.includes('earn') || input.includes('farm')) {
    currentProtocols.slice(0, 3).forEach((protocol, index) => {
      const suggestionText = `Show ${protocol} yield opportunities`
      const baseScore = 95 - index
      const relevanceScore = calculateRelevanceScore(suggestionText, input, currentWord)
      
      suggestions.push({
        id: `yield-${protocol.toLowerCase()}`,
        text: suggestionText,
        description: `View current ${protocol} yield farming options`,
        category: 'command',
        icon: 'BarChart3',
        score: baseScore + relevanceScore
      })
    })
  }
  
  return suggestions
}

// Check if suggestion is already in the input or conflicts with user intent
const isSuggestionAlreadyUsed = (suggestionText: string, userInput: string): boolean => {
  const suggestion = suggestionText.toLowerCase().trim()
  const input = userInput.toLowerCase().trim()
  
  // Check if the exact suggestion text appears in the input
  if (input.includes(suggestion)) {
    return true
  }
  
  // If user has already chosen a specific action, don't suggest similar actions
  // For example, if input contains "check price", don't suggest "check balance", "check yield", etc.
  const userActionPatterns = [
    { pattern: /check (price|rates?|cost)/, blockSimilar: /check (balance|yield|wallet|my|portfolio)/ },
    { pattern: /check (balance|wallet)/, blockSimilar: /check (price|yield|rates?|cost)/ },
    { pattern: /check (yield|farm|earning)/, blockSimilar: /check (price|balance|wallet)/ },
    { pattern: /swap \w+/, blockSimilar: /check|find|show/ },
    { pattern: /find \w+ opportunities/, blockSimilar: /check|swap/ }
  ]
  
  for (const { pattern, blockSimilar } of userActionPatterns) {
    if (pattern.test(input) && blockSimilar.test(suggestion)) {
      return true
    }
  }
  
  // Special handling for "Find [Protocol] opportunities" pattern
  if (suggestion.startsWith('find ') && suggestion.includes(' opportunities')) {
    // If input already has any "Find [something] opportunities", block similar suggestions
    if (input.includes('find ') && input.includes(' opportunities')) {
      return true
    }
  }
  
  // Special handling for protocol-specific suggestions
  const protocolPatterns = [
    /find \w+ opportunities/,
    /show \w+ (yields?|opportunities)/,
    /check \w+ (balance|positions)/,
    /swap \w+ for \w+/
  ]
  
  for (const pattern of protocolPatterns) {
    if (pattern.test(suggestion) && pattern.test(input)) {
      return true
    }
  }
  
  // Check if key parts of the suggestion are already in the input
  const suggestionWords = suggestion.split(' ').filter(word => word.length > 3)
  const inputWords = input.split(' ')
  
  // If most key words from suggestion are in input, consider it used
  const usedWords = suggestionWords.filter(word => 
    inputWords.some(inputWord => inputWord.includes(word) || word.includes(inputWord))
  )
  
  return usedWords.length >= Math.max(1, suggestionWords.length * 0.7)
}

// Contextual suggestion helper
const getContextualSuggestions = (input: string, currentWord: string, network: string) => {
  const suggestions: any[] = []
  
  // Basic actions
  if (input.includes('check') || input.includes('balance')) {
    const balanceSuggestion = 'Check my wallet balance'
    if (!isSuggestionAlreadyUsed(balanceSuggestion, input)) {
      suggestions.push({
        id: 'check-balance',
        text: balanceSuggestion,
        description: 'View your current token balances',
        category: 'command',
        icon: 'Wallet',
        score: 90 + calculateRelevanceScore(balanceSuggestion, input, currentWord)
      })
    }
  }
  
  if (input.includes('swap') || input.startsWith('sw')) {
    const swapSuggestion = 'Swap ETH for USDC'
    if (!isSuggestionAlreadyUsed(swapSuggestion, input)) {
      suggestions.push({
        id: 'swap-tokens',
        text: swapSuggestion,
        description: 'Exchange tokens on the current network',
        category: 'command',
        icon: 'ArrowRightLeft',
        score: 85 + calculateRelevanceScore(swapSuggestion, input, currentWord)
      })
    }
  }
  
  if (input.includes('gas') || input.includes('fee')) {
    const gasSuggestion = 'Check current gas prices'
    if (!isSuggestionAlreadyUsed(gasSuggestion, input)) {
      suggestions.push({
        id: 'gas-price',
        text: gasSuggestion,
        description: 'Get network fee information',
        category: 'command',
        icon: 'Fuel',
        score: 90 + calculateRelevanceScore(gasSuggestion, input, currentWord)
      })
    }
  }
  
  // Network-specific tokens
  const networkTokens = {
    'ethereum': ['ETH', 'USDC', 'USDT', 'DAI', 'AAVE', 'UNI'],
    'arbitrum': ['ETH', 'USDC', 'ARB', 'GMX', 'MAGIC'],
    'base': ['ETH', 'USDC', 'AERO', 'BALD'],
    'polygon': ['MATIC', 'USDC', 'USDT', 'QUICK'],
    'optimism': ['ETH', 'USDC', 'OP', 'VELO']
  }
  
  const currentTokens = networkTokens[network?.toLowerCase() as keyof typeof networkTokens] || networkTokens.ethereum
  
  // Token-specific suggestions
  currentTokens.forEach((token, index) => {
    if (currentWord.includes(token.toLowerCase()) || token.toLowerCase().startsWith(currentWord)) {
      const tokenSuggestion = `Check ${token} balance`
      if (!isSuggestionAlreadyUsed(tokenSuggestion, input)) {
        suggestions.push({
          id: `token-${token}`,
          text: tokenSuggestion,
          description: `View ${token} token balance`,
          category: 'token',
          icon: 'Coins',
          score: (80 - index) + calculateRelevanceScore(tokenSuggestion, input, currentWord)
        })
      }
    }
  })
  
  // Context-specific suggestions when user has chosen an action
  if (input.includes('check price')) {
    // User wants to check prices - suggest specific tokens/assets
    const priceTargets = ['ETH', 'BTC', 'USDC', 'ARB', 'PENDLE']
    priceTargets.forEach((token, index) => {
      const priceSuggestion = `Check ${token} price`
      if (!isSuggestionAlreadyUsed(priceSuggestion, input)) {
        suggestions.push({
          id: `price-${token}`,
          text: priceSuggestion,
          description: `Get current ${token} price`,
          category: 'token',
          icon: 'DollarSign',
          score: 90 - index + calculateRelevanceScore(priceSuggestion, input, currentWord)
        })
      }
    })
  } else if (input.includes('swap') && !input.includes(' for ')) {
    // User wants to swap but hasn't specified tokens yet
    const swapSuggestions = ['Swap ETH for USDC', 'Swap USDC for ETH', 'Swap ETH for ARB']
    swapSuggestions.forEach((swapText, index) => {
      if (!isSuggestionAlreadyUsed(swapText, input)) {
        suggestions.push({
          id: `swap-${index}`,
          text: swapText,
          description: 'Exchange tokens',
          category: 'command',
          icon: 'ArrowRightLeft',
          score: 85 - index + calculateRelevanceScore(swapText, input, currentWord)
        })
      }
    })
  } else if (input.length > 3 && !input.includes('check ') && !input.includes('swap ') && !input.includes('find ')) {
    // Generic helpful suggestions only when user hasn't chosen a specific action
    const portfolioSuggestion = 'Show my portfolio overview'
    const marketSuggestion = 'Analyze market trends'
    
    if (!isSuggestionAlreadyUsed(portfolioSuggestion, input)) {
      suggestions.push({
        id: 'portfolio-overview',
        text: portfolioSuggestion,
        description: 'View complete portfolio',
        category: 'command',
        icon: 'PieChart',
        score: 75 + calculateRelevanceScore(portfolioSuggestion, input, currentWord)
      })
    }
    
    if (!isSuggestionAlreadyUsed(marketSuggestion, input)) {
      suggestions.push({
        id: 'market-analysis',
        text: marketSuggestion,
        description: 'Get market insights',
        category: 'command',
        icon: 'TrendingUp',
        score: 70 + calculateRelevanceScore(marketSuggestion, input, currentWord)
      })
    }
  }
  
  // Add network-aware suggestions
  const networkSuggestions = getNetworkAwareSuggestions(input, network, currentWord)
  // Filter out already used network suggestions
  const filteredNetworkSuggestions = networkSuggestions.filter(suggestion => 
    !isSuggestionAlreadyUsed(suggestion.text, input)
  )
  suggestions.push(...filteredNetworkSuggestions)
  
  // Sort by score and take top 8
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
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
    
    // Update suggestions ref when suggestions change
    useEffect(() => {
      currentSuggestionsRef.current = suggestions
    }, [suggestions])
    const [cursorPosition, setCursorPosition] = useState(0)
    const [isComposing, setIsComposing] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [previousValue, setPreviousValue] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const suggestionEngine = useRef<any>(null)
    const networkContext = useNetwork()
    const typingTimeoutRef = useRef<NodeJS.Timeout>()
    const suggestionTimeoutRef = useRef<NodeJS.Timeout>()
    const selectedItemRef = useRef<HTMLDivElement>(null)
    const currentSuggestionsRef = useRef<any[]>([])
    
    // Use a static message to prevent any flashing
    const emptyStateMessage = "Continue typing for suggestions..."
    
    
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
          
          // Keep dropdown open while typing to prevent flashing
          setIsOpen(true)
          
          // When user is deleting, be more conservative with suggestion updates
          // Only update suggestions if the deletion results in a significantly different context
          if (isDeleting && currentSuggestionsRef.current.length > 0) {
            // Check if current suggestions are still relevant
            const currentSuggestions = currentSuggestionsRef.current.filter(suggestion => {
              const suggestionText = suggestion.text.toLowerCase()
              const inputWords = input.split(/\s+/)
              
              // Keep suggestions that still match the current input context
              return inputWords.some(word => 
                word.length > 1 && (
                  suggestionText.includes(word) || 
                  calculateRelevanceScore(suggestion.text, input, word) > 50
                )
              )
            })
            
            // If we still have relevant suggestions, keep them and return early
            if (currentSuggestions.length > 0) {
              // Only update if suggestions actually changed
              if (!areSuggestionsEqual(currentSuggestions, currentSuggestionsRef.current)) {
                setSuggestions(currentSuggestions)
              }
              return
            }
          }

          // Extract the current word being typed at cursor position
          const beforeCursor = value.slice(0, cursorPosition)
          const afterCursor = value.slice(cursorPosition)
          const words = beforeCursor.split(/\s+/)
          const currentWord = words[words.length - 1] || ''
          const currentWordLower = currentWord.toLowerCase()
          

          // Try to use the sophisticated suggestion engine if available
          if (suggestionEngine.current) {
            const context = {
              selectedNetwork: networkContext.selectedChain,
              isDemoMode: networkContext.isDemoMode,
              userInput: value,
              cursorPosition
            }

            try {
              newSuggestions = await suggestionEngine.current.generateSuggestions(context)
              
              // Add network-aware suggestions if the engine results are insufficient
              if (newSuggestions.length < 3) {
                const networkSuggestions = getNetworkAwareSuggestions(input, networkContext.selectedChain, currentWordLower)
                // Filter out already used suggestions
                const filteredNetworkSuggestions = networkSuggestions.filter(suggestion => 
                  !isSuggestionAlreadyUsed(suggestion.text, value)
                )
                newSuggestions.push(...filteredNetworkSuggestions)
              }
            } catch (error) {
              console.error('Suggestion engine error:', error)
              newSuggestions = []
            }
          } else {
            // Fallback to contextual suggestions based on user input and network
            if (input) {
              newSuggestions = getContextualSuggestions(input, currentWordLower, networkContext.selectedChain)
              
            }
          }
            
          // Filter out suggestions that are already used and remove duplicates
          const filteredSuggestions = newSuggestions.filter(suggestion => 
            !isSuggestionAlreadyUsed(suggestion.text, value)
          )
          
          // Remove duplicates by text
          const uniqueSuggestions = filteredSuggestions.filter((suggestion, index, self) => 
            index === self.findIndex(s => s.text === suggestion.text)
          )
          
          // Sort by relevance score
          const sortedSuggestions = uniqueSuggestions.sort((a, b) => b.score - a.score)
          
          // Only update suggestions if they actually changed to prevent flashing
          const suggestionsChanged = !areSuggestionsEqual(sortedSuggestions, currentSuggestionsRef.current)
          if (suggestionsChanged) {
            setSuggestions(sortedSuggestions)
          }
          
          
          // Show popover when there are relevant suggestions
          if (sortedSuggestions.length > 0 && value.trim().length > 0) {
            setIsOpen(true)
            // Only reset selection if suggestions actually changed or user is adding content
            if (suggestionsChanged && !isDeleting) {
              setSelectedIndex(0) // Auto-select first item by default
            }
          } else if (value.trim().length > 0) {
            // Keep dropdown open even without suggestions to prevent flashing
            setIsOpen(true)
            if (!isDeleting) {
              setSelectedIndex(-1)
            }
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
      // Use different delays based on whether user is typing or deleting
      if (value.trim().length > 0) {
        const delay = isDeleting ? 150 : 50 // Longer delay when deleting for stability
        suggestionTimeoutRef.current = setTimeout(generateSuggestions, delay)
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
    }, [value, isMounted, networkContext, cursorPosition, isDeleting, isTyping])

    // Scroll selected item into view
    const scrollItemIntoView = (index: number) => {
      setTimeout(() => {
        const itemElement = document.querySelector(`[data-item-index="${index}"]`) as HTMLElement
        
        if (itemElement) {
          // Use scrollIntoView for reliable scrolling
          itemElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          })
        }
      }, 0)
    }

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
            setSelectedIndex(prev => {
              const newIndex = prev === -1 ? 0 : (prev < suggestions.length - 1 ? prev + 1 : 0)
              scrollItemIntoView(newIndex)
              return newIndex
            })
            return
          case 'ArrowUp':
            e.preventDefault()
            setSelectedIndex(prev => {
              const newIndex = prev === -1 ? suggestions.length - 1 : (prev > 0 ? prev - 1 : suggestions.length - 1)
              scrollItemIntoView(newIndex)
              return newIndex
            })
            return
          case 'Tab':
            if (selectedIndex >= 0) {
              e.preventDefault()
              applySuggestion(suggestions[selectedIndex])
              return
            }
            break
          case 'Enter':
            if (selectedIndex >= 0) {
              e.preventDefault()
              applySuggestion(suggestions[selectedIndex])
              return
            }
            // Allow Enter to pass through for form submission
            break
          case ' ':
            // Space key accepts first suggestion if available
            if (suggestions.length > 0) {
              e.preventDefault()
              applySuggestion(suggestions[selectedIndex >= 0 ? selectedIndex : 0])
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
      
      // Handle different types of suggestions
      let newValue = ''
      let newCursorPos = 0
      
      if (suggestion.category === 'completion') {
        // For completion suggestions, append to current word
        const spaceAfter = afterCursor.startsWith(' ') ? '' : ' '
        newValue = beforeCursor + suggestion.text + spaceAfter + afterCursor
        newCursorPos = beforeCursor.length + suggestion.text.length + spaceAfter.length
      } else {
        // For full suggestions, replace the current word
        newValue = currentValue.slice(0, wordStart) + suggestion.text + afterCursor
        newCursorPos = wordStart + suggestion.text.length
      }

      onChange(newValue)
      
      // Close the popover after selection and reset state
      setIsOpen(false)
      setSelectedIndex(-1)
      setSuggestions([]) // Clear suggestions to prevent them from reappearing
      
      // Clear any pending suggestion timeouts to prevent suggestions from reappearing
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current)
      }
      
      // Set cursor position after the inserted text and maintain focus
      setTimeout(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
        textarea.focus() // Keep focus on textarea for continuous typing
        
        // Allow immediate re-generation of suggestions for continuous context
        setIsTyping(false)
      }, 0)
    }

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      onChange(newValue)
      setCursorPosition(e.target.selectionStart || 0)
      
      // Detect if user is deleting (shorter input)
      const isDeletingContent = newValue.length < previousValue.length
      setIsDeleting(isDeletingContent)
      setPreviousValue(newValue)
      
      // Set typing state to true when user types
      setIsTyping(true)
      
      // Clear previous typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Set typing to false after user stops typing for 50ms (faster response)
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
        setIsDeleting(false) // Reset deletion state after typing stops
      }, 50)
      
      // Keep dropdown open and let useEffect handle suggestion updates
      // This prevents flashing by maintaining the dropdown state
      // Only reset selection if user is adding new content (not deleting)
      if (!isDeletingContent) {
        setSelectedIndex(-1) // Reset selection only when adding content
      }
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
            <Command className="border-0 bg-transparent" shouldFilter={false}>
              <CommandList className="max-h-[200px] overflow-y-auto" role="listbox">
                {suggestions.length > 0 ? (
                  <CommandGroup className="p-0">
                    {suggestions.map((suggestion, index) => (
                      <CommandItem
                        key={suggestion.id}
                        value={suggestion.text}
                        onSelect={() => applySuggestion(suggestion)}
                        data-item-index={index}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 cursor-pointer border-0",
                          "hover:bg-accent hover:text-accent-foreground",
                          "data-[selected=true]:bg-transparent data-[selected=true]:text-inherit",
                          index === selectedIndex && "!bg-accent !text-accent-foreground"
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
                    {emptyStateMessage}
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
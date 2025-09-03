'use client'

import { cn } from '@/lib/utils'
import { usePrivy } from '@privy-io/react-auth'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, MessageCirclePlus, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useArtifact } from './artifact/artifact-context'
import { AutoCompleteInput, AutoCompleteInputRef } from './autocomplete-input'
import { SuggestionPills } from './chat-panel/suggestion-pills'
import { useMobileKeyboardHandler } from './mobile-keyboard-handler'
import { LazyWallet } from './wallet'

import { MarketPulse } from './market-pulse'

import { TooltipProvider } from '@/components/ui/tooltip'
import { useNetwork } from '@/lib/network/context'
import { ChainSelector } from './chain-selector'
import { DemoToggle } from './demo-toggle'
import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { WelcomeMessage } from './welcome-messages'
import { WithTooltip } from './with-tooltip'

// Mobile keyboard handler removed - let browser handle naturally

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void // Consider a more specific type if possible
  isAutoScroll: boolean
  onVideoBgChange?: (isVideoActive: boolean) => void // Kept for potential Header integration via RootLayout
  chatId?: string // Chat ID for sharing functionality
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append,
  isAutoScroll,
  onVideoBgChange, // Destructure this prop
  chatId
}: ChatPanelProps) {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const inputRef = useRef<AutoCompleteInputRef>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)

  const { ready, authenticated, user } = usePrivy()

  const { close: closeArtifact } = useArtifact()
  const welcomeSeed = useRef(new Date().getDate()).current

  const { selectedChain, setSelectedChain, isDemoMode, setIsDemoMode } =
    useNetwork()

  // Use mobile keyboard handler
  useMobileKeyboardHandler({ inputRef })

  function handleCompositionStart() {
    return setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    closeArtifact()
    router.push('/')
  }

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      lastPart?.type === 'tool-invocation' &&
      lastPart?.toolInvocation?.state === 'call'
    )
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlQuery = urlParams.get('q')

    const queryToSubmit = urlQuery || query

    if (
      isFirstRender.current &&
      queryToSubmit &&
      queryToSubmit.trim().length > 0
    ) {
      handleInputChange({
        target: { value: queryToSubmit }
      } as React.ChangeEvent<HTMLTextAreaElement>)

      setTimeout(() => {
        const form = document.querySelector('form') as HTMLFormElement
        if (form) {
          form.requestSubmit()
        }
      }, 100)

      isFirstRender.current = false

      if (urlQuery) {
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [query, handleInputChange])

  useEffect(() => {
    setMounted(true)
  }, [])

  const showVideoBg = messages.length === 0 && mounted

  useEffect(() => {
    if (onVideoBgChange) {
      onVideoBgChange(showVideoBg)
    }
  }, [showVideoBg, onVideoBgChange])

  const showEmptyScreenContent = messages.length === 0 // For internal content visibility

  function handleScrollToBottom(
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ): void {
    event.preventDefault()
    const scrollContainer = document.getElementById('scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <TooltipProvider>
      {/* Use a fragment if VideoBackground is fixed and outside the main div's flow */}
      {showVideoBg && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/background.avif)' }}
        />
      )}
      {/* <VideoBackground
        src="/videos/background.mp4"
        poster="/videos/background_poster.jpg"
        isActive={showVideoBg}
        playbackRate={0.15}
      /> */}
      <div
        className={cn(
          'w-full group/form-container shrink-0 flex justify-center',
          showVideoBg ? 'bg-transparent' : 'bg-background',
          'px-2 sm:px-4',
          'z-10'
        )}
      >
        <div className="w-full max-w-3xl">
          {showEmptyScreenContent && ( // Or use showVideoBg if content should only appear with video
            <div
              className={cn(
                'mb-2 sm:mb-4 flex flex-col items-center gap-1 sm:gap-2 w-full min-h-[120px] sm:min-h-[180px] pt-4 sm:pt-8',
                'bg-transparent'
              )}
            >
              <div className="mb-6 w-full flex justify-center">
                {' '}
                {/* <-- Added spacing here */}
                <MarketPulse />
              </div>

              <IconLogo
                className={cn(
                  'size-6 sm:size-8 md:size-12',
                  showVideoBg
                    ? 'text-white/90 drop-shadow-md'
                    : 'text-muted-foreground'
                )}
              />

              {/* Use LazyWallet component instead of directly embedding wallet details */}
              <LazyWallet showVideoBg={showVideoBg} />

              {mounted && (
                <WelcomeMessage
                  seed={welcomeSeed}
                  className={cn(
                    showVideoBg ? 'text-gray-100 drop-shadow-md' : ''
                  )}
                />
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className={cn('w-full relative')}>
            {/* Scroll-down button */}
            {!isAutoScroll && messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute -top-10 right-2 z-20 size-7 sm:size-8 rounded-full shadow-md"
                onClick={handleScrollToBottom}
                title="Scroll to bottom"
              >
                <ChevronDown size={14} className="sm:size-16" />
              </Button>
            )}
            <div
              className={cn(
                'relative flex flex-col w-full gap-0.5 sm:gap-1 md:gap-2 rounded-2xl sm:rounded-3xl border min-h-[50px] sm:min-h-[60px]',
                showVideoBg
                  ? 'bg-black/40 border-white/20 backdrop-blur-sm' // Darker, subtle overlay
                  : 'bg-muted border-input'
              )}
            >
              <AutoCompleteInput
                ref={inputRef}
                value={input}
                onChange={(value) => {
                  handleInputChange({
                    target: { value }
                  } as React.ChangeEvent<HTMLTextAreaElement>)
                }}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder="Start your crypto journey with one simple prompt..."
                disabled={isLoading || isToolInvocationInProgress()}
                className={cn(
                  'resize-none w-full min-h-[38px] bg-transparent border-0 p-2 sm:p-3 md:p-4 text-xs sm:text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  showVideoBg
                    ? 'text-white placeholder:text-gray-300'
                    : 'text-current placeholder:text-muted-foreground'
                )}
                onKeyDown={e => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !isComposing &&
                    !enterDisabled
                  ) {
                    if (input.trim().length === 0) {
                      e.preventDefault()
                      return
                    }
                    e.preventDefault()
                    const textarea = e.target as HTMLTextAreaElement
                    textarea.form?.requestSubmit()
                  }
                }}
                rows={1}
              />
              <div
                className={cn(
                  'flex items-center justify-between p-2 sm:p-3 text-[10px] sm:text-xs',
                  showVideoBg ? 'text-gray-300' : 'text-current'
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scrollbar">
                  <SearchModeToggle />
                  <WithTooltip tooltipText="Enter Demo Mode: no gas, no losses, just learning. Demo network is refreshed every day.">
                    <DemoToggle />
                  </WithTooltip>
                  <ChainSelector />
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {messages.length > 0 && (
                    <Button
                      variant="outline" // Your existing props
                      size="icon" // Your existing props
                      onClick={handleNewChat} // Your existing props
                      className={cn(
                        'shrink-0 rounded-full group size-7 sm:size-8',
                        showVideoBg &&
                          'text-white border-white/30 hover:bg-white/10'
                      )}
                      type="button" // Your existing props
                      disabled={isLoading || isToolInvocationInProgress()} // Your existing props
                    >
                      <MessageCirclePlus className="size-3.5 sm:size-4 group-hover:rotate-12 transition-all" />
                    </Button>
                  )}
                  <Button
                    type={isLoading ? 'button' : 'submit'} // Your existing props
                    size={'icon'} // Your existing props
                    variant={'outline'} // Your existing props
                    className={cn(
                      isLoading && 'animate-pulse', // Your existing props
                      showVideoBg &&
                        'text-white border-white/30 hover:bg-white/10',
                      'rounded-full size-7 sm:size-8'
                    )}
                    disabled={
                      (input.length === 0 && !isLoading) ||
                      isToolInvocationInProgress()
                    } // Your existing props
                    onClick={isLoading ? stop : undefined} // Your existing props
                  >
                    {isLoading ? (
                      <Square size={16} className="sm:size-20" />
                    ) : (
                      <ArrowUp size={16} className="sm:size-20" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            {!showEmptyScreenContent && mounted && (
              <div className="flex items-center justify-center p-2 sm:p-3 text-[10px] sm:text-xs text-center text-muted-foreground">
                Jarvis is experimental. Always verify transaction details before
                confirming.
              </div>
            )}

            {showEmptyScreenContent && mounted && (
              <div className="mt-2 overflow-hidden">
                <SuggestionPills
                  onSelectSuggestion={suggestion => {
                    handleInputChange({
                      target: { value: suggestion }
                    } as React.ChangeEvent<HTMLTextAreaElement>)
                  }}
                />
              </div>
            )}
          </form>
        </div>
      </div>
    </TooltipProvider>
  )
}

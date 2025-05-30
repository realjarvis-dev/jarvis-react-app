'use client'

import { cn } from '@/lib/utils'
import {
  usePrivy
} from '@privy-io/react-auth'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, MessageCirclePlus, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { RefObject, useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { toast } from 'sonner'
import { useArtifact } from './artifact/artifact-context'
import { SuggestionPills } from './chat-panel/suggestion-pills'
import { LazyWallet } from './wallet'

import { MarketPulse } from './market-pulse'

import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { VideoBackground } from './ui/video-background'
import { WelcomeMessage } from './welcome-messages'


function useKeyboardAvoidance({
  ref
}: {
  ref: RefObject<HTMLTextAreaElement>
}): void {
  useEffect(() => {
    const hasVisualViewport =
      typeof window !== 'undefined' && 'visualViewport' in window
    const hasVirtualKeyboard =
      typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator

    const handleVisualViewportChange = () => {
      if (!window.visualViewport) return

      const keyboardHeight = Math.max(
        0,
        window.innerHeight - window.visualViewport.height
      )

      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${keyboardHeight}px`
      )

      if (keyboardHeight > 0) {
        document.body.classList.add('keyboard-visible')

        setTimeout(() => {
          const scrollContainer = document.getElementById('scroll-container')
          if (scrollContainer && ref.current) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            })
          }
        }, 300)
      } else {
        document.body.classList.remove('keyboard-visible')
      }
    }

    if (hasVirtualKeyboard) {
      // @ts-ignore - VirtualKeyboard API may not be in types yet
      navigator.virtualKeyboard.overlaysContent = true

      const updateInset = () => {
        // @ts-ignore - VirtualKeyboard API may not be in types yet
        const keyboardHeight = navigator.virtualKeyboard.boundingRect.height
        document.documentElement.style.setProperty(
          '--keyboard-inset',
          `${keyboardHeight}px`
        )

        if (keyboardHeight > 0) {
          document.body.classList.add('keyboard-visible')

          setTimeout(() => {
            const scrollContainer = document.getElementById('scroll-container')
            if (scrollContainer && ref.current) {
              scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
              })
            }
          }, 300)
        } else {
          document.body.classList.remove('keyboard-visible')
        }
      }

      // @ts-ignore - VirtualKeyboard API may not be in types yet
      navigator.virtualKeyboard.addEventListener('geometrychange', updateInset)

      return () => {
        // @ts-ignore - VirtualKeyboard API may not be in types yet
        navigator.virtualKeyboard.removeEventListener(
          'geometrychange',
          updateInset
        )
      }
    }
    else if (hasVisualViewport && window.visualViewport) {
      window.visualViewport.addEventListener(
        'resize',
        handleVisualViewportChange
      )
      window.visualViewport.addEventListener(
        'scroll',
        handleVisualViewportChange
      )

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener(
            'resize',
            handleVisualViewportChange
          )
          window.visualViewport.removeEventListener(
            'scroll',
            handleVisualViewportChange
          )
        }
      }
    }
    else {
      const handleResize = () => {
        const portraitOrientation = window.innerHeight > window.innerWidth
        const normalAspectRatio = portraitOrientation ? 1.6 : 0.625 // Typical aspect ratios
        const currentAspectRatio = window.innerWidth / window.innerHeight

        const isKeyboardVisible =
          Math.abs(currentAspectRatio - normalAspectRatio) > 0.3

        if (isKeyboardVisible) {
          const estimatedKeyboardHeight = window.innerHeight * 0.4
          document.documentElement.style.setProperty(
            '--keyboard-inset',
            `${estimatedKeyboardHeight}px`
          )
          document.body.classList.add('keyboard-visible')

          setTimeout(() => {
            const scrollContainer = document.getElementById('scroll-container')
            if (scrollContainer) {
              scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
              })
            }
          }, 300)
        } else {
          document.documentElement.style.setProperty('--keyboard-inset', '0px')
          document.body.classList.remove('keyboard-visible')
        }
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [ref])
}

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
  onVideoBgChange // Destructure this prop
}: ChatPanelProps) {


  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  
  const { ready, authenticated, user } = usePrivy()
  
  const { close: closeArtifact } = useArtifact()
  const welcomeSeed = useRef(new Date().getDate()).current

  useKeyboardAvoidance({ ref: inputRef })

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
    
    if (isFirstRender.current && queryToSubmit && queryToSubmit.trim().length > 0) {
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

  function handleScrollToBottom(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    event.preventDefault();
    const scrollContainer = document.getElementById('scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }
  
  return (
    <> {/* Use a fragment if VideoBackground is fixed and outside the main div's flow */}
      <VideoBackground
        src="/videos/background.mp4" // Ensure this path is correct
        poster="/videos/background_poster.jpg" // Optional: path to a poster image
        isActive={showVideoBg}
        playbackRate={0.15} // Adjust playback speed as desired
      />
      <div
        className={cn(
          'w-full group/form-container shrink-0 flex justify-center',
          showVideoBg ? 'bg-transparent' : 'bg-background',
          'sticky bottom-0 px-2 sm:px-4',
          'pb-[calc(var(--keyboard-inset,0px)+env(safe-area-inset-bottom,4px))]',
          'z-10' // Ensure ChatPanel content is above the z-0 video
        )}
        style={{
          position: 'sticky',
          bottom: 0,
          overflow: 'hidden'
        }}
      >
        <div className="w-full max-w-3xl">
          {showEmptyScreenContent && ( // Or use showVideoBg if content should only appear with video
            <div
              className={cn(
                'mb-2 sm:mb-4 flex flex-col items-center gap-1 sm:gap-2 w-full min-h-[120px] sm:min-h-[180px] pt-4 sm:pt-8',
                'bg-transparent'
              )}
            >
              <div className="mb-6 w-full flex justify-center"> {/* <-- Added spacing here */}
                <MarketPulse />
              </div>

              <IconLogo
                className={cn(
                  'size-6 sm:size-8 md:size-12',
                  showVideoBg ? 'text-white/90 drop-shadow-md' : 'text-muted-foreground'
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
              <Textarea
                ref={inputRef}
                name="input"
                rows={1}
                maxRows={5}
                tabIndex={0}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder="Start your crypto journey with one simple prompt..."
                spellCheck={false}
                value={input}
                disabled={isLoading || isToolInvocationInProgress()}
                className={cn(
                  'resize-none w-full min-h-[38px] bg-transparent border-0 p-2 sm:p-3 md:p-4 text-xs sm:text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  showVideoBg
                    ? 'text-white placeholder:text-gray-300'
                    : 'text-current placeholder:text-muted-foreground'
                )}
                onChange={e => {
                  handleInputChange(e)
                }}
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
                onFocus={e => {
                  e.preventDefault()
                  if (e.target) {
                    e.target.focus({ preventScroll: true })
                  }

                  setTimeout(() => {
                    const scrollContainer = document.getElementById('scroll-container')
                    if (scrollContainer) {
                      scrollContainer.scrollTo({
                        top: scrollContainer.scrollHeight,
                        behavior: 'smooth'
                      })
                    }
                  }, 350)
                }}
              />
              <div
                className={cn(
                  'flex items-center justify-between p-2 sm:p-3 text-[10px] sm:text-xs',
                  showVideoBg ? 'text-gray-300' : 'text-current'
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scrollbar">
                  <SearchModeToggle />
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {messages.length > 0 && (
                    <Button
                      variant="outline" // Your existing props
                      size="icon" // Your existing props
                      onClick={handleNewChat} // Your existing props
                      className={cn(
                        'shrink-0 rounded-full group size-7 sm:size-8',
                        showVideoBg && 'text-white border-white/30 hover:bg-white/10'
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
                      showVideoBg && 'text-white border-white/30 hover:bg-white/10',
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
    </>
  )
}

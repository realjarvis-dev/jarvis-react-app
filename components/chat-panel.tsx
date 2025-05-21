'use client'

import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import {
    WalletWithMetadata,
    useHeadlessDelegatedActions,
    usePrivy,
    useSolanaWallets,
    useWallets
} from '@privy-io/react-auth'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, MessageCirclePlus, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { RefObject, useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { toast } from 'sonner'
import { useWalletAddresses } from '../lib/hooks/use-evm-and-sol-addresses'
import { useArtifact } from './artifact/artifact-context'
import { SuggestionPills } from './chat-panel/suggestion-pills'
import { CopyableWalletAddress } from './copyable-wallet-address'
import { CopyableWalletAddressSkeleton } from './copyable-wallet-address-skeleton'
import { ModelSelector } from './model-selector'
import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { VideoBackground } from './ui/video-background'; // Import the VideoBackground component
import { WelcomeMessage } from './welcome-messages'

// Custom hook for keyboard avoidance on mobile
function useKeyboardAvoidance({
  ref
}: {
  ref: RefObject<HTMLTextAreaElement>
}): void {
  useEffect(() => {
    // Check if visualViewport API is available
    const hasVisualViewport =
      typeof window !== 'undefined' && 'visualViewport' in window
    const hasVirtualKeyboard =
      typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator

    // Function to handle visual viewport changes
    const handleVisualViewportChange = () => {
      if (!window.visualViewport) return

      // Calculate keyboard height as difference between window height and visual viewport height
      // This works on both iOS and Android
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - window.visualViewport.height
      )

      // Set the CSS variable
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${keyboardHeight}px`
      )

      // Add a class to the body when keyboard is visible (for potential CSS adjustments)
      if (keyboardHeight > 0) {
        document.body.classList.add('keyboard-visible')

        // Wait for the layout to stabilize before scrolling
        setTimeout(() => {
          const scrollContainer = document.getElementById('scroll-container')
          if (scrollContainer && ref.current) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            })
          }
        }, 300) // Increased from 100ms to 300ms for better reliability
      } else {
        document.body.classList.remove('keyboard-visible')
      }
    }

    // Handle VirtualKeyboard API if available (modern Chrome/Android)
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

          // Wait before scrolling to ensure layout is updated
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
    // Fallback to Visual Viewport API (works on iOS Safari)
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
    // Last resort fallback for older browsers
    else {
      const handleResize = () => {
        // More reliable detection using aspect ratio rather than fixed percentage
        const portraitOrientation = window.innerHeight > window.innerWidth
        const normalAspectRatio = portraitOrientation ? 1.6 : 0.625 // Typical aspect ratios
        const currentAspectRatio = window.innerWidth / window.innerHeight

        // Keyboard is likely visible if aspect ratio changes significantly
        const isKeyboardVisible =
          Math.abs(currentAspectRatio - normalAspectRatio) > 0.3

        if (isKeyboardVisible) {
          // Estimate keyboard height (rough approximation)
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
  models?: Model[]
  isAutoScroll: boolean
  onVideoBgChange?: (isVideoActive: boolean) => void // Kept for potential Header integration via RootLayout
  // isPageGradientActive?: boolean; // This prop might be removed if video is self-contained
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
  models,
  isAutoScroll,
  onVideoBgChange // Destructure this prop
  // isPageGradientActive // This prop might be removed
}: ChatPanelProps) {
  // const [showEmptyScreen, setShowEmptyScreen] = useState(false) // Your existing state
  const [mounted, setMounted] = useState(false)
  const router = useRouter() // Your existing state
  const inputRef = useRef<HTMLTextAreaElement>(null) // Your existing state
  const isFirstRender = useRef(true) // Your existing state
  const [isComposing, setIsComposing] = useState(false) // Your existing state
  const [enterDisabled, setEnterDisabled] = useState(false) // Your existing state
  const { ready, authenticated, user } = usePrivy() // Your existing state
  const { evmAddress, solAddress } = useWalletAddresses(
    ready,
    authenticated,
    user
  ) // Your existing state
  const { wallets: evmWallets, ready: evmReady } = useWallets() // Your existing state
  const { wallets: solanaWallets, ready: solanaReady } = useSolanaWallets() // Your existing state
  const [isNewUser, setIsNewUser] = useState(false) // Your existing state
  // const [walletAddress, setWalletAddress] = useState('') // Your existing state
  const { close: closeArtifact } = useArtifact() // Your existing state
  const { delegateWallet } = useHeadlessDelegatedActions() // Your existing state
  const welcomeSeed = useRef(new Date().getDate()).current // Your existing state

  // Apply keyboard avoidance hook
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

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        id: Date.now().toString(),
        role: 'user',
        content: query
      }) // Added id for consistency
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, append]) // Added append to dependency array

  useEffect(() => {
    if (!ready) {
      return
    }
    if (!authenticated) {
      return
    }
    if (user) {
      const created = new Date(user!.createdAt)
      const now = new Date()

      // e.g. consider "first login" if created < 1 minute ago
      const isFirstLogin = now.getTime() - created.getTime() < 60_000
      setIsNewUser(isFirstLogin)
      // setWalletAddress(user.wallet?.address || ''); // Your existing logic
    }
  }, [ready, authenticated, user])

  useEffect(() => {
    if (!ready) return
    if (!authenticated) return
    if (!user) return
    if (!evmReady) return
    if (!solanaReady) return
    const created = new Date(user!.createdAt)
    const now = new Date()

    // e.g. consider "first login" if created < 2 minutes ago
    const isFirstLogin = now.getTime() - created.getTime() < 120_000
    // always delegate, for demo purposes
    if (evmReady && solanaReady && isFirstLogin) {
      const evmWallet = user.linkedAccounts.find(wallet => {
        if (wallet.type == 'wallet') {
          return (
            wallet.walletClientType === 'privy' &&
            wallet.chainType === 'ethereum' &&
            wallet.connectorType === 'embedded'
          )
        }
      }) as WalletWithMetadata | undefined
      console.log('evmReady', evmReady)
      console.log(evmWallets)
      console.log('evmWallet in chat panel', evmWallet)

      const solWallet = solanaWallets.find(
        wallet => wallet.walletClientType === 'privy'
      ) as WalletWithMetadata | undefined

      if (evmWallet?.address && !evmWallet.delegated) {
        console.log('evmWallet delegated')
        delegateWallet({ address: evmWallet.address, chainType: 'ethereum' })
        toast.success('EVM wallet delegated')
      }
      if (solWallet?.address && !solWallet.delegated) {
        console.log('solWallet delegated')
        delegateWallet({ address: solWallet.address, chainType: 'solana' })
        toast.success('Solana wallet delegated')
      }
    }
  }, [
    evmReady,
    solanaReady,
    authenticated,
    ready,
    user,
    delegateWallet,
    solanaWallets
  ]) // Added missing dependencies

  useEffect(() => {
    setShowEmptyScreen(messages.length === 0)
    setMounted(true)

    if (messages.length === 0 && mounted) {
      inputRef.current?.focus()
    }
  }, [messages.length, mounted, delegateWallet, evmWallets, solanaWallets, user])

  // Determine if the video background should be active
  const showVideoBg = messages.length === 0 && mounted

  // Notify parent (RootLayout) about video background state change (if Header needs it)
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
        playbackRate={0.75} // Adjust playback speed as desired
      />
      <div
        className={cn(
          'w-full group/form-container shrink-0 flex justify-center',
          // MODIFIED: ChatPanel main container becomes transparent if video is active
          showVideoBg ? 'bg-transparent' : 'bg-background',
          'sticky bottom-0 px-2 sm:px-4',
          'pb-[calc(var(--keyboard-inset,0px)+env(safe-area-inset-bottom,4px))]',
          'z-10' // Ensure ChatPanel content is above the z-0 video
        )}
        style={{
          position: 'sticky',
          bottom: 0,
          // zIndex is now on the div itself, VideoBackground is z-0
          overflow: 'hidden'
        }}
      >
        <div className="w-full max-w-3xl">
          {showEmptyScreenContent && ( // Or use showVideoBg if content should only appear with video
            <div
              className={cn(
                'mb-2 sm:mb-4 flex flex-col items-center gap-1 sm:gap-2 w-full min-h-[120px] sm:min-h-[180px] pt-4 sm:pt-8',
                // MODIFIED: This section is transparent to show the video
                'bg-transparent'
              )}
            >
              <IconLogo
                className={cn(
                  'size-6 sm:size-8 md:size-12',
                  // MODIFIED: Text color for video background
                  showVideoBg ? 'text-white/90 drop-shadow-md' : 'text-muted-foreground'
                )}
              />
              {/* Wallet details - existing logic, only classNames for text color change */}
              {!mounted || !ready ? (
                <div className="w-full max-w-[280px] sm:max-w-none mt-2">
                  <CopyableWalletAddressSkeleton
                    className={cn(
                      'justify-center text-xs sm:text-sm',
                      showVideoBg && 'bg-white/10 text-gray-300'
                    )}
                  />
                  <CopyableWalletAddressSkeleton
                    className={cn(
                      'justify-center text-xs sm:text-sm mt-1',
                      showVideoBg && 'bg-white/10 text-gray-300'
                    )}
                  />
                </div>
              ) : !authenticated ? (
                <div className="w-full max-w-[280px] sm:max-w-none mt-2 text-center">
                  <CopyableWalletAddress
                    walletAddress=""
                    className={cn(
                      'justify-center text-xs sm:text-sm',
                      showVideoBg ? 'text-gray-300 drop-shadow-sm' : ''
                    )}
                    walletAddressNotAvailableText="Please sign in"
                  />
                  <CopyableWalletAddress
                    walletAddress=""
                    className={cn(
                      'justify-center text-xs sm:text-sm mt-1',
                      showVideoBg ? 'text-gray-300 drop-shadow-sm' : ''
                    )}
                    walletAddressNotAvailableText="We will create/retrieve your wallets"
                  />
                </div>
              ) : (isNewUser || (evmAddress && solAddress)) ? ( // Your existing conditions
                <div className="w-full max-w-[320px] sm:max-w-sm mt-2 text-center">
                  {isNewUser && (
                    <CopyableWalletAddress
                      walletAddress={''}
                      className={cn(
                        'justify-center text-xs sm:text-sm',
                        showVideoBg ? 'text-green-300 drop-shadow-sm' : 'text-green-600'
                      )}
                      walletAddressNotAvailableText="Congrats! Your wallet has been created."
                    />
                  )}
                  <CopyableWalletAddress
                    walletAddress={evmAddress || 'Loading...'}
                    className={cn(
                      'justify-center text-xs sm:text-sm truncate mt-1',
                      showVideoBg ? 'text-gray-200 drop-shadow-sm' : ''
                    )}
                    walletAddressIntroText="EVM wallet:"
                  />
                  <CopyableWalletAddress
                    walletAddress={solAddress || 'Loading...'}
                    className={cn(
                      'justify-center text-xs sm:text-sm truncate mt-1',
                      showVideoBg ? 'text-gray-200 drop-shadow-sm' : ''
                    )}
                    walletAddressIntroText="Solana wallet:"
                  />
                </div>
              ) : (
                <div className="w-full max-w-[280px] sm:max-w-none mt-2 text-center">
                  <CopyableWalletAddress
                    walletAddress={evmAddress}
                    className={cn(
                      'justify-center text-xs sm:text-sm truncate',
                      showVideoBg ? 'text-gray-200 drop-shadow-sm' : ''
                    )}
                    walletAddressIntroText="EVM wallet:"
                  />
                  <CopyableWalletAddress
                    walletAddress={solAddress}
                    className={cn(
                      'justify-center text-xs sm:text-sm truncate mt-1',
                      showVideoBg ? 'text-gray-200 drop-shadow-sm' : ''
                    )}
                    walletAddressIntroText="Solana wallet:"
                  />
                </div>
              )}
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
                // MODIFIED: Input bar: Semi-transparent background over video
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
                  // MODIFIED: Text and placeholder color for video background
                  showVideoBg
                    ? 'text-white placeholder:text-gray-300'
                    : 'text-current placeholder:text-muted-foreground'
                )}
                onChange={e => {
                  handleInputChange(e)
                  // setShowEmptyScreen(e.target.value.length === 0) // your existing logic
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

                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      const scrollContainer = document.getElementById('scroll-container')
                      if (scrollContainer) {
                        scrollContainer.scrollTo({
                          top: scrollContainer.scrollHeight,
                          behavior: 'smooth'
                        })
                      }
                    }, 350)
                  })
                }}
                // onBlur={() => setShowEmptyScreen(false)} // your existing logic
              />
              <div
                className={cn(
                  'flex items-center justify-between p-2 sm:p-3 text-[10px] sm:text-xs',
                  // MODIFIED: Text color for controls for video background
                  showVideoBg ? 'text-gray-300' : 'text-current'
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto hide-scrollbar">
                  <ModelSelector models={models || []} />
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
                        // MODIFIED: Button style for video background
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
                      // MODIFIED: Button style for video background
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

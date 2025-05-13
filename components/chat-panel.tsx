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
import { CopyableWalletAddress } from './copyable-wallet-address'
import { CopyableWalletAddressSkeleton } from './copyable-wallet-address-skeleton'
import { EmptyScreen } from './empty-screen'
import { ModelSelector } from './model-selector'
import { SearchModeToggle } from './search-mode-toggle'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { WelcomeMessage } from './welcome-messages'

// Custom hook for keyboard avoidance on mobile
function useKeyboardAvoidance({ ref }: { ref: RefObject<HTMLTextAreaElement> }): void {
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
      document.documentElement.style.setProperty('--keyboard-inset', `${keyboardHeight}px`)

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
        document.documentElement.style.setProperty('--keyboard-inset', `${keyboardHeight}px`)

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
        navigator.virtualKeyboard.removeEventListener('geometrychange', updateInset)
      }
    }
    // Fallback to Visual Viewport API (works on iOS Safari)
    else if (hasVisualViewport && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange)
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange)

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleVisualViewportChange)
          window.visualViewport.removeEventListener('scroll', handleVisualViewportChange)
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
        const isKeyboardVisible = Math.abs(currentAspectRatio - normalAspectRatio) > 0.3

        if (isKeyboardVisible) {
          // Estimate keyboard height (rough approximation)
          const estimatedKeyboardHeight = window.innerHeight * 0.4
          document.documentElement.style.setProperty('--keyboard-inset', `${estimatedKeyboardHeight}px`)
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
  append: (message: any) => void
  models?: Model[]
  /** Whether auto-scroll is currently active (at bottom) */
  isAutoScroll: boolean
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
  isAutoScroll
}: ChatPanelProps) {
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const { ready, authenticated, user } = usePrivy()
  const { evmAddress, solAddress } = useWalletAddresses(
    ready,
    authenticated,
    user
  )
  const { wallets: evmWallets, ready: evmReady } = useWallets()
  const { wallets: solanaWallets, ready: solanaReady } = useSolanaWallets()
  const [isNewUser, setIsNewUser] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const { close: closeArtifact } = useArtifact()
  const { delegateWallet } = useHeadlessDelegatedActions()
  // Generate a deterministic seed for welcome message based on date
  // This will change each day but remain consistent throughout the day
  const welcomeSeed = useRef(new Date().getDate()).current

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
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

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
      setWalletAddress(user.wallet?.address || '')
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
  }, [evmReady, solanaReady, authenticated, ready])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Add scroll to bottom handler
  const handleScrollToBottom = () => {
    const scrollContainer = document.getElementById('scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div
      className={cn(
        'w-full bg-background group/form-container shrink-0 flex justify-center',
        'sticky bottom-0 px-4 sm:px-4 md:px-4',
        'pb-[calc(var(--keyboard-inset,0px)+env(safe-area-inset-bottom,4px))]'
      )}
      style={{
        // This ensures the panel stays at the bottom on mobile
        position: 'sticky',
        bottom: 0,
        zIndex: 30
      }}
    >
      <div className="w-full max-w-3xl">
        {messages.length === 0 && (
          <div className="mb-2 sm:mb-4 md:mb-6 lg:mb-10 flex flex-col items-center gap-1 sm:gap-2 md:gap-4 w-full min-h-[180px] sm:min-h-[200px]">
            <IconLogo className="size-8 sm:size-10 md:size-12 text-muted-foreground" />
            {!mounted ? (
              <div>
                <CopyableWalletAddressSkeleton className="justify-center" />
                <CopyableWalletAddressSkeleton className="justify-center" />
              </div>
            ) : !ready ? (
              <div>
                <CopyableWalletAddressSkeleton className="justify-center" />
                <CopyableWalletAddressSkeleton className="justify-center" />
              </div>
            ) : ready && !authenticated ? (
              <div>
                <CopyableWalletAddress
                  walletAddress=""
                  className="justify-center"
                  walletAddressNotAvailableText="Please sign in"
                />
                <CopyableWalletAddress
                  walletAddress=""
                  className="justify-center"
                  walletAddressNotAvailableText="We will create/retrieve your wallets"
                />
              </div>
            ) : evmAddress && solAddress && isNewUser ? (
              <div>
                <CopyableWalletAddress
                  walletAddress={''}
                  className="justify-center"
                  walletAddressNotAvailableText="Congrats! Your wallet has been created."
                />
                <CopyableWalletAddress
                  walletAddress={evmAddress}
                  className="justify-center"
                  walletAddressIntroText="EVM wallet:"
                />
                <CopyableWalletAddress
                  walletAddress={solAddress}
                  className="justify-center"
                  walletAddressIntroText="Solana wallet:"
                />
              </div>
            ) : evmAddress && solAddress ? (
              <div>
                <CopyableWalletAddress
                  walletAddress={evmAddress}
                  className="justify-center"
                  walletAddressIntroText="EVM wallet:"
                />
                <CopyableWalletAddress
                  walletAddress={solAddress}
                  className="justify-center"
                  walletAddressIntroText="Solana wallet:"
                />
              </div>
            ) : null}
            {mounted && <WelcomeMessage seed={welcomeSeed} />}
          </div>
        )}
        <form onSubmit={handleSubmit} className={cn('w-full relative')}>
          {/* Add scroll-down button to ChatPanel right top - show when not auto scrolling */}
          {!isAutoScroll && messages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
              onClick={handleScrollToBottom}
              title="Scroll to bottom"
            >
              <ChevronDown size={16} />
            </Button>
          )}

          <div className="relative flex flex-col w-full gap-0.5 sm:gap-1 md:gap-2 bg-muted rounded-3xl border border-input min-h-[60px] sm:min-h-[80px]">
            <Textarea
              ref={inputRef}
              name="input"
              rows={1}
              maxRows={5}
              tabIndex={0}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="Ask a question..."
              spellCheck={false}
              value={input}
              disabled={isLoading || isToolInvocationInProgress()}
              className="resize-none w-full min-h-[38px] sm:min-h-[48px] bg-transparent border-0 p-3 sm:p-3 md:p-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              onChange={e => {
                handleInputChange(e)
                setShowEmptyScreen(e.target.value.length === 0)
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
                setShowEmptyScreen(true)
                // Ensure we don't scroll when focused on mobile
                e.preventDefault()
                if (e.target) {
                  e.target.focus({ preventScroll: true })
                }
                
                // Delay scrolling until after keyboard is fully open
                // Using requestAnimationFrame for smoother timing
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    const scrollContainer = document.getElementById('scroll-container');
                    if (scrollContainer) {
                      scrollContainer.scrollTo({
                        top: scrollContainer.scrollHeight,
                        behavior: 'smooth'
                      });
                    }
                  }, 350); // Longer delay to account for keyboard animation
                });
              }}
              onBlur={() => setShowEmptyScreen(false)}
            />

            {/* Bottom menu area */}
            <div className="flex items-center justify-between p-3 sm:p-3 md:p-3 text-[10px] sm:text-xs md:text-sm">
              <div className="flex items-center gap-2 sm:gap-2 md:gap-2 overflow-hidden">
                <ModelSelector models={models || []} />
                <SearchModeToggle />
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNewChat}
                    className="shrink-0 rounded-full group"
                    type="button"
                    disabled={isLoading || isToolInvocationInProgress()}
                  >
                    <MessageCirclePlus className="size-4 group-hover:rotate-12 transition-all" />
                  </Button>
                )}
                <Button
                  type={isLoading ? 'button' : 'submit'}
                  size={'icon'}
                  variant={'outline'}
                  className={cn(isLoading && 'animate-pulse', 'rounded-full')}
                  disabled={
                    (input.length === 0 && !isLoading) ||
                    isToolInvocationInProgress()
                  }
                  onClick={isLoading ? stop : undefined}
                >
                  {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
                </Button>
              </div>
            </div>
          </div>

          {messages.length === 0 && mounted && (
            <EmptyScreen
              submitMessage={message => {
                handleInputChange({
                  target: { value: message }
                } as React.ChangeEvent<HTMLTextAreaElement>)
              }}
              className={cn(showEmptyScreen ? 'visible' : 'invisible')}
            />
          )}
        </form>
      </div>
    </div>
  )
}

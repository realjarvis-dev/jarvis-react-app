'use client'

import React, { useMemo } from 'react'

// Array of welcome messages to display
const welcomeMessages = [
  'Maximize your yield potential!',
  'Global opportunities in your wallet!',
  'Amplify your crypto experience!',
  'Unlock endless opportunities with your wallet!'
]

// Get a message by index or seed
export const getWelcomeMessage = (indexOrSeed?: number): string => {
  if (indexOrSeed === undefined) {
    return welcomeMessages[0]
  }

  // Use modulo to ensure the index is within bounds
  const index =
    typeof indexOrSeed === 'number'
      ? Math.abs(indexOrSeed) % welcomeMessages.length
      : 0

  return welcomeMessages[index]
}

// Get all available messages
export const getAllWelcomeMessages = (): string[] => {
  return [...welcomeMessages]
}

interface WelcomeMessageProps {
  className?: string
  // Optional seed or index to deterministically select a message
  seed?: number
  // Optional specific message index to display
  messageIndex?: number
}

export const WelcomeMessage = React.memo(function WelcomeMessage({
  className,
  seed,
  messageIndex
}: WelcomeMessageProps) {
  const index = messageIndex !== undefined ? messageIndex : seed
  const message = getWelcomeMessage(index)

  const memoizedClassName = useMemo(() => {
    return `text-center text-base sm:text-lg md:text-2xl lg:text-3xl font-semibold w-full ${className || ''} max-w-full px-0 sm:px-1 md:px-2 lg:px-4 min-h-[30px] sm:min-h-[40px] break-words`
  }, [className])

  return (
    <p
      className={memoizedClassName}
      style={{
        willChange: 'transform',
        contain: 'layout style'
      }}
    >
      {message}
    </p>
  )
})

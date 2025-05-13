'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { WelcomeMessage, getAllWelcomeMessages } from './welcome-messages'

export function WelcomeMessageDemo() {
  // Get all available messages to display them
  const allMessages = getAllWelcomeMessages()

  // State for the current seed or index
  const [currentSeed, setCurrentSeed] = useState<number>(0)
  const [useSpecificIndex, setUseSpecificIndex] = useState<boolean>(false)

  // Change the seed randomly but deterministically
  const changeSeed = () => {
    // Generate a pseudorandom number based on the current seed
    const newSeed = (currentSeed * 13 + 7) % 100
    setCurrentSeed(newSeed)
    setUseSpecificIndex(false)
  }

  // Select a specific message index
  const selectMessageIndex = (index: number) => {
    setCurrentSeed(index)
    setUseSpecificIndex(true)
  }

  return (
    <div className="p-6 space-y-6 border rounded-lg">
      <h2 className="text-2xl font-bold">Welcome Message Demo</h2>

      {/* Current welcome message */}
      <div className="p-4 border rounded-lg bg-muted">
        <h3 className="text-lg font-medium mb-2">Current Message:</h3>
        <WelcomeMessage
          seed={currentSeed}
          messageIndex={useSpecificIndex ? currentSeed : undefined}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Using {useSpecificIndex ? 'specific index' : 'seed'}: {currentSeed}
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Change Message:</h3>
          <Button onClick={changeSeed} className="mr-2">
            Generate New Seed
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Select Specific Message:</h3>
          <div className="flex flex-wrap gap-2">
            {allMessages.map((message, index) => (
              <Button
                key={index}
                variant={
                  useSpecificIndex && currentSeed === index
                    ? 'default'
                    : 'outline'
                }
                onClick={() => selectMessageIndex(index)}
              >
                Message {index + 1}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* All available messages */}
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-medium mb-2">All Available Messages:</h3>
        <ul className="space-y-2">
          {allMessages.map((message, index) => (
            <li key={index} className="text-sm">
              <strong>{index + 1}:</strong> {message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

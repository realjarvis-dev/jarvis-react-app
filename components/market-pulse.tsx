'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface TrendingCoinData {
  id: string
  name: string
  shortName: string
  price: number
  priceChange24h: number
  trend: 'up' | 'down'
}

function formatTrendingPrice(price: number): string {
  if (price >= 100) {
    // Large prices (e.g., BTC): integer only
    return price.toFixed(0)
  } else if (price >= 1) {
    // Moderate prices: 2 decimal places
    return price.toFixed(2)
  } else {
    // Small prices (meme coins): dynamically show 4 significant digits
    const priceStr = price.toPrecision(4)
    return parseFloat(priceStr).toString()
  }
}

export function MarketPulse() {
  const [coins, setCoins] = useState<TrendingCoinData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const router = useRouter()

  useEffect(() => {
    const abortController = new AbortController()
    const url = '/api/market-pulse'
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      signal: abortController.signal
    }

    async function fetchTrendingCoins() {
      try {
        setIsLoading(true)
        const response = await fetch(url, options)
        
        if (abortController.signal.aborted) {
          return
        }
        
        const json = await response.json()

        if (json.error || !json.coins || !Array.isArray(json.coins)) {
          console.error('Error fetching trending coins:', json.error || 'Invalid response format')
          setCoins([])
          setIsLoading(false)
          return
        }

        setCoins(json.coins)
        setIsLoading(false)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Error fetching trending coins:', err)
        setCoins([])
        setIsLoading(false)
      }
    }

    fetchTrendingCoins()
    
    const interval = setInterval(() => {
      if (!document.hidden && !abortController.signal.aborted) {
        fetchTrendingCoins()
      }
    }, 10 * 60000)

    const handleVisibilityChange = () => {
      if (!document.hidden && !abortController.signal.aborted) {
        fetchTrendingCoins()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      abortController.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) return

    let scrollAmount = scrollContainer.scrollWidth - scrollContainer.clientWidth
    const scrollSpeed = 0.3 // Adjust this value for slower or faster scrolling

    const autoScroll = () => {
      if (scrollContainer.scrollWidth > scrollContainer.clientWidth) {
        scrollAmount -= scrollSpeed
        if (scrollAmount <= 0) {
          scrollAmount = scrollContainer.scrollWidth - scrollContainer.clientWidth // Reset scroll to end
        }
        scrollContainer.scrollLeft = scrollAmount
      }
      animationRef.current = requestAnimationFrame(autoScroll)
    }

    autoScroll()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [coins])

  const handleCoinClick = (coin: TrendingCoinData) => {
    // Create a specific query that will trigger the market data tool
    const query = `Show me the market chart and analysis for ${coin.name} (${coin.id})`
    
    // Navigate to new chat with pre-filled query
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  if (!coins || coins.length === 0) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className="
        flex overflow-x-auto gap-4 py-1 px-2 hide-scrollbar text-xs sm:text-sm text-white/90
        bg-gradient-to-r from-[#bfc7ce]/30 via-[#e6e8ea]/40 to-[#bfc7ce]/30
        rounded-full
        shadow-[0_0_24px_4px_rgba(200,200,220,0.45),0_0_4px_1px_rgba(255,255,255,0.18)]
        backdrop-blur-sm
        border border-white/20
      "
    >
      {coins.map((coin, index) => (
        <div 
          key={index} 
          className="flex items-center gap-1 whitespace-nowrap cursor-pointer hover:bg-white/10 rounded-md px-2 py-1 transition-colors duration-200 select-none"
          onClick={() => handleCoinClick(coin)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCoinClick(coin)
            }
          }}
          title={`Click to analyze ${coin.name}`}
        >
          <span className="font-semibold">
            <span className="sm:hidden">{coin.shortName}</span>
            <span className="hidden sm:inline">{coin.name}</span>
          </span>
          <span
            className={`sm:text-white ${
              coin.trend === 'down' ? 'text-red-300' : 'text-green-300'
            }`}
          >
            ${formatTrendingPrice(coin.price)}
          </span>
          <span
            className={`hidden sm:flex items-center gap-0.5 ${
              coin.trend === 'down' ? 'text-red-300' : 'text-green-300'
            }`}
          >
            {coin.trend === 'down' ? (
              <TrendingDown size={12} />
            ) : (
              <TrendingUp size={12} />
            )}
            {coin.priceChange24h.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

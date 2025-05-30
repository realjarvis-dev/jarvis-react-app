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
  const scrollRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const router = useRouter()

  useEffect(() => {
    const url = '/api/market-pulse'
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    }

    async function fetchTrendingCoins() {
      try {
        const response = await fetch(url, options)
        const json = await response.json()

        if (json.error || !json.coins || !Array.isArray(json.coins)) {
          console.error('Error fetching trending coins:', json.error || 'Invalid response format')
          return // Keep existing coins state, don't update with undefined
        }

        // The API now returns processed data directly
        setCoins(json.coins)
      } catch (err) {
        console.error('Error fetching trending coins:', err)
      }
    }

    fetchTrendingCoins()
    const interval = setInterval(fetchTrendingCoins, 10 * 60000) // fetch every 10 minutes

    return () => clearInterval(interval)
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

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto gap-4 py-1 px-2 hide-scrollbar text-xs sm:text-sm text-white/90 bg-gradient-to-r from-yellow-400/20 via-yellow-300/30 to-yellow-400/20 rounded-full shadow-glow backdrop-blur-sm"
    >
      {coins.length === 0 && (
        <div className="animate-pulse flex gap-4 w-full">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 w-20 bg-yellow-100/30 rounded" />
          ))}
        </div>
      )}
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

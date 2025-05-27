'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface CoinData {
  name: string
  shortName: string
  price: number
  priceChange24h: number
  trend: 'up' | 'down'
}

function formatPrice(price: number): string {
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
  const [coins, setCoins] = useState<CoinData[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()

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

        const coinsData: CoinData[] = json.coins.map((coin: any) => {
          const priceChange = coin.item.data.price_change_percentage_24h.usd
          return {
            name: coin.item.name,
            shortName: coin.item.symbol,
            price: coin.item.data.price,
            priceChange24h: priceChange,
            trend: priceChange >= 0 ? 'up' : 'down',
          }
        })

        setCoins(coinsData)
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
        <div key={index} className="flex items-center gap-1 whitespace-nowrap">
          <span className="font-semibold">
            <span className="sm:hidden">{coin.shortName}</span>
            <span className="hidden sm:inline">{coin.name}</span>
          </span>
          <span
            className={`sm:text-white ${
              coin.trend === 'down' ? 'text-red-300' : 'text-green-300'
            }`}
          >
            ${formatPrice(coin.price)}
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

'use client'

import { cn } from '@/lib/utils/index'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'

interface MarketDataPoint {
  timestamp: number
  price: number
  marketCap: number
  volume: number
}

interface MarketChartProps {
  data?: MarketDataPoint[]
  coinId?: string
  currency?: string
  className?: string
  isLoading?: boolean
}

// Format large numbers with appropriate suffixes
function formatLargeNumber(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

// Format price with appropriate decimal places and commas
function formatPrice(price: number): string {
  if (price >= 100) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } else if (price >= 1) {
    return price.toFixed(4)
  } else if (price >= 0.001) {
    // For values between 0.001 and 1, use 5 decimal places for better readability
    return price.toFixed(5)
  } else if (price >= 0.0001) {
    // For smaller values, use 6 decimal places
    return price.toFixed(6)
  } else {
    // For very small values, use scientific notation to prevent overflow
    return price.toExponential(3)
  }
}

// Format timestamp to readable date and time
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Calculate price change percentage
function calculatePriceChange(data: MarketDataPoint[]): { change: number; isPositive: boolean } {
  if (data.length < 2) return { change: 0, isPositive: true }
  
  const firstPrice = data[0].price
  const lastPrice = data[data.length - 1].price
  const change = ((lastPrice - firstPrice) / firstPrice) * 100
  
  return { change: Math.abs(change), isPositive: change >= 0 }
}

// Statistics component
function MarketStats({ data }: { data: MarketDataPoint[] }) {
  if (data.length === 0) return null

  const prices = data.map(d => d.price)
  const volumes = data.map(d => d.volume)
  const marketCaps = data.map(d => d.marketCap)

  const stats = {
    current: data[data.length - 1],
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
    avgMarketCap: marketCaps.reduce((a, b) => a + b, 0) / marketCaps.length
  }

  const priceChange = calculatePriceChange(data)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Current Price</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">${formatPrice(stats.current.price)}</span>
            <Badge 
              variant="outline" 
              className={cn(
                "flex items-center gap-1 w-fit text-xs py-0.5 px-1.5 border-0",
                priceChange.isPositive 
                  ? "bg-green-500/20 text-green-400" 
                  : "bg-red-500/20 text-red-400"
              )}
            >
              {priceChange.isPositive ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {priceChange.change.toFixed(2)}%
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Market Cap</span>
        </div>
        <div className="text-base font-semibold">{formatLargeNumber(stats.current.marketCap)}</div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">24h Volume</span>
        </div>
        <div className="text-base font-semibold">{formatLargeNumber(stats.current.volume)}</div>
      </div>

      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Price Range</span>
        </div>
        <div className="text-xs font-semibold flex items-center gap-1 overflow-hidden">
          <span className="font-mono truncate">${formatPrice(stats.min)}</span>
          <span className="text-muted-foreground flex-shrink-0">-</span>
          <span className="font-mono truncate">${formatPrice(stats.max)}</span>
        </div>
      </div>
    </div>
  )
}

// Interactive chart component with hover functionality
function InteractiveChart({ data }: { data: MarketDataPoint[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<MarketDataPoint | null>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length === 0) return

    const rect = svgRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Convert screen coordinates to SVG coordinates
    const viewBoxWidth = 300
    const viewBoxHeight = 120
    
    const svgX = (x / rect.width) * viewBoxWidth
    const svgY = (y / rect.height) * viewBoxHeight
    
    if (data.length === 0) return
    
    const padding = 25
    const prices = data.map(d => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice
    
    const points = data.map((point, index) => ({
      x: padding + (index / (data.length - 1)) * (viewBoxWidth - 2 * padding),
      y: viewBoxHeight - padding - ((point.price - minPrice) / priceRange) * (viewBoxHeight - 2 * padding),
      data: point
    }))
    
    // Find the closest data point
    let closestPoint = points[0]
    let minDistance = Math.abs(svgX - points[0].x)
    
    for (let i = 1; i < points.length; i++) {
      const distance = Math.abs(svgX - points[i].x)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = points[i]
      }
    }
    
    setHoveredPoint(closestPoint.data)
    setMousePosition({ x: closestPoint.x, y: closestPoint.y })
  }, [data])

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null)
    setMousePosition(null)
  }, [])
  
  if (data.length === 0) return null

  const prices = data.map(d => d.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice

  // Responsive dimensions
  const viewBoxWidth = 300
  const viewBoxHeight = 120
  const padding = 25

  // Create smooth curve path
  const createSmoothPath = (points: Array<{x: number, y: number}>) => {
    if (points.length < 2) return ''
    
    let path = `M ${points[0].x} ${points[0].y}`
    
    for (let i = 1; i < points.length; i++) {
      const current = points[i]
      const previous = points[i - 1]
      
      if (i === 1) {
        path += ` L ${current.x} ${current.y}`
      } else {
        const cp1x = previous.x + (current.x - previous.x) * 0.5
        const cp1y = previous.y
        path += ` Q ${cp1x} ${cp1y} ${current.x} ${current.y}`
      }
    }
    
    return path
  }

  const points = data.map((point, index) => ({
    x: padding + (index / (data.length - 1)) * (viewBoxWidth - 2 * padding),
    y: viewBoxHeight - padding - ((point.price - minPrice) / priceRange) * (viewBoxHeight - 2 * padding),
    data: point
  }))

  const smoothPath = createSmoothPath(points)
  const priceChange = calculatePriceChange(data)
  const strokeColor = priceChange.isPositive ? '#10b981' : '#ef4444'
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="w-full h-72 relative">
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} 
        className="w-full h-full cursor-crosshair"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {/* Gradient fill */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Horizontal gridlines (price levels) */}
        {Array.from({ length: 6 }).map((_, i) => {
          const yPos = viewBoxHeight - padding - (i / 5) * (viewBoxHeight - 2 * padding)
          return (
            <line
              key={`h-grid-${i}`}
              x1={padding}
              y1={yPos}
              x2={viewBoxWidth - padding}
              y2={yPos}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="3,2"
              opacity="0.4"
            />
          )
        })}
        
        {/* Vertical gridlines (time intervals) */}
        {Array.from({ length: 7 }).map((_, i) => {
          const xPos = padding + (i / 6) * (viewBoxWidth - 2 * padding)
          return (
            <line
              key={`v-grid-${i}`}
              x1={xPos}
              y1={padding}
              x2={xPos}
              y2={viewBoxHeight - padding}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="3,2"
              opacity="0.4"
            />
          )
        })}
        
        {/* Area fill */}
        <path
          d={`${smoothPath} L ${viewBoxWidth - padding} ${viewBoxHeight - padding} L ${padding} ${viewBoxHeight - padding} Z`}
          fill={`url(#${gradientId})`}
        />
        
        {/* Main price line with glow */}
        <path
          d={smoothPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        
        {/* Hover line and point */}
        {mousePosition && (
          <g>
            {/* Vertical hover line */}
            <line
              x1={mousePosition.x}
              y1={padding}
              x2={mousePosition.x}
              y2={viewBoxHeight - padding}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2,2"
              opacity="0.6"
            />
            {/* Hover point */}
            <circle
              cx={mousePosition.x}
              cy={mousePosition.y}
              r="2"
              fill={strokeColor}
              stroke="white"
              strokeWidth="1"
            />
          </g>
        )}
        
        {/* Y-axis Price labels */}
        {Array.from({ length: 6 }).map((_, i) => {
          const priceStep = minPrice + (priceRange * i) / 5
          const yPos = viewBoxHeight - padding - (i / 5) * (viewBoxHeight - 2 * padding)
          return (
            <text 
              key={i}
              x={padding - 4} 
              y={yPos + 1.5} 
              textAnchor="end" 
              className="text-[4px] fill-muted-foreground font-mono"
            >
              ${formatPrice(priceStep)}
            </text>
          )
        })}
        
        {/* X-axis Date labels */}
        {Array.from({ length: 7 }).map((_, i) => {
          const dayIndex = Math.floor((i / 6) * (data.length - 1))
          const date = new Date(data[dayIndex]?.timestamp || Date.now() - (6 - i) * 24 * 60 * 60 * 1000)
          const xPos = padding + (i / 6) * (viewBoxWidth - 2 * padding)
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          
          return (
            <g key={i}>
              <text 
                x={xPos} 
                y={viewBoxHeight - 8} 
                textAnchor="middle" 
                className="text-[4px] fill-muted-foreground font-mono"
              >
                {dateStr}
              </text>
            </g>
          )
        })}
      </svg>
      
      {/* Hover tooltip */}
      {hoveredPoint && mousePosition && (
        <div 
          className="absolute pointer-events-none z-10 bg-background border rounded-lg shadow-lg p-3 text-sm"
          style={{
            left: `${(mousePosition.x / viewBoxWidth) * 100}%`,
            top: `${(mousePosition.y / viewBoxHeight) * 100}%`,
            transform: 'translate(-50%, -120%)'
          }}
        >
          <div className="space-y-1">
            <div className="font-semibold text-foreground">
              ${formatPrice(hoveredPoint.price)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateTime(hoveredPoint.timestamp)}
            </div>
            <div className="text-xs space-y-0.5 pt-1 border-t">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Market Cap:</span>
                <span>{formatLargeNumber(hoveredPoint.marketCap)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Volume:</span>
                <span>{formatLargeNumber(hoveredPoint.volume)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Loading skeleton
function ChartSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}

export function MarketChart({ 
  data = [], 
  coinId = 'bitcoin', 
  currency = 'USD', 
  className,
  isLoading = false 
}: MarketChartProps) {
  const [timeRange, setTimeRange] = useState('7D')

  if (isLoading) {
    return (
      <Card className={cn("w-full bg-background/80 backdrop-blur-sm", className)}>
        <CardHeader>
          <CardTitle className="capitalize text-lg">
            {coinId} {coinId.toUpperCase()}
          </CardTitle>
          <CardDescription>Loading market data...</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className={cn("w-full bg-background/80 backdrop-blur-sm", className)}>
        <CardHeader>
          <CardTitle className="capitalize text-lg">
            {coinId} {coinId.toUpperCase()}
          </CardTitle>
          <CardDescription>No market data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data to display
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full bg-background/80 backdrop-blur-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="capitalize text-lg">
            {coinId} {coinId.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs">
            Last 7 days • {currency}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <MarketStats data={data} />
        <div className="border rounded-lg p-2 bg-gradient-to-br from-background to-muted/20">
          <InteractiveChart data={data} />
        </div>
      </CardContent>
    </Card>
  )
}  
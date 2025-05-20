import { KodiakIsland } from '@/lib/types/kodiak'
import React from 'react'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

export interface KodiakIslandCardProps {
  island: KodiakIsland
}

/**
 * Format APR for display
 */
function formatAPR(apr: number): string {
  return `${(apr * 100).toFixed(2)}%`
}

/**
 * Format USD value with K/M suffix for readability
 */
function formatUSD(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

/**
 * Format current price for display
 */
function formatCurrentPrice(island: KodiakIsland): string {
  if (!island.currentPrice) return 'N/A'
  return `${island.currentPrice.toFixed(6)} ${island.token1.symbol}`
}

/**
 * Format simplified price range display similar to the Kodiak platform
 */
function formatPriceRangeForDisplay(island: KodiakIsland): JSX.Element {
  const token0Symbol = island.token0.symbol
  const token1Symbol = island.token1.symbol
  
  return (
    <div className="flex flex-col space-y-1 text-sm">
      <div className="flex items-center">
        <span className="text-muted-foreground mr-2">Min:</span>
        <span className="font-medium">{token0Symbol} 1 = {formatTickToPrice(island.lowerTick, island.token0.decimals, island.token1.decimals)} {token1Symbol}</span>
      </div>
      <div className="flex items-center">
        <span className="text-muted-foreground mr-2">Max:</span>
        <span className="font-medium">{token0Symbol} 1 = {formatTickToPrice(island.upperTick, island.token0.decimals, island.token1.decimals)} {token1Symbol}</span>
      </div>
    </div>
  )
}

/**
 * Convert tick to price and format for display
 */
function formatTickToPrice(tick: number, token0Decimals: number, token1Decimals: number): string {
  const tickToPrice = Math.pow(1.0001, tick)
  const price = tickToPrice * Math.pow(10, token0Decimals - token1Decimals)
  return price.toFixed(4)
}

/**
 * A card component that displays information about a Kodiak Island
 */
export const KodiakIslandCard: React.FC<KodiakIslandCardProps> = ({ island }) => {
  // Format pool name
  const poolName = `${island.token0.symbol}-${island.token1.symbol}`
  const feeTier = (island.feeTier / 10000).toFixed(2) + '%'
  
  return (
    <Card className="bg-card/80 w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{poolName}</CardTitle>
              <Badge variant={island.isManaged ? "secondary" : "outline"} className={`text-xs ${island.isManaged ? "bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-orange-200 text-orange-800 dark:bg-orange-950 dark:text-orange-300"}`}>
                {island.isManaged ? 'Managed' : 'Unmanaged'}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              <span className="font-bold">Swap fee:</span> {feeTier}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-muted-foreground">APR</span>
            <span className="font-bold text-lg text-green-500">
              {formatAPR(island.apr.feeApr)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-muted-foreground">TVL</span>
            <span className="font-semibold">
              {formatUSD(island.tvl.usdValue)}
            </span>
          </div>

          <div className="flex flex-col space-y-2">
            <span className="text-sm font-bold text-muted-foreground">Price Range</span>
            {formatPriceRangeForDisplay(island)}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-muted-foreground">Current Price</span>
            <span className="font-semibold text-amber-500">
              {island.token0.symbol} 1 = {formatCurrentPrice(island)}
            </span>
          </div>
          
          {island.isManaged && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-muted-foreground">Manager Fee</span>
              <span className="font-medium">
                {(island.managerFeeBPS / 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 
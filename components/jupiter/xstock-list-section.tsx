'use client'

import { Check, Copy, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { XStockData } from '../../lib/jupiter/search'
import { CollapsibleMessage } from '../collapsible-message'
import { DefaultSkeleton } from '../default-skeleton'
import { ToolArgsSection } from '../section'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface XStockCardProps {
  xstock: XStockData
}

function formatPrice(price: number): string {
  return price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(6)}`
}

function formatMarketCap(mcap: number): string {
  if (mcap >= 1e9) return `$${(mcap / 1e9).toFixed(2)}B`
  if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(2)}M`
  if (mcap >= 1e3) return `$${(mcap / 1e3).toFixed(2)}K`
  return `$${mcap.toFixed(2)}`
}

function formatLiquidity(liquidity: number): string {
  if (liquidity >= 1e6) return `$${(liquidity / 1e6).toFixed(2)}M`
  if (liquidity >= 1e3) return `$${(liquidity / 1e3).toFixed(2)}K`
  return `$${liquidity.toFixed(2)}`
}

function formatPriceChange(change: number): string {
  const formatted = Math.abs(change * 100).toFixed(2)
  return `${change >= 0 ? '+' : '-'}${formatted}%`
}

function getPriceChangeColor(change: number): string {
  if (change > 0) return 'text-green-400'
  if (change < 0) return 'text-red-400'
  return 'text-gray-400'
}

function getPriceChangeIcon(change: number) {
  if (change > 0) return <TrendingUp className="w-3 h-3" />
  if (change < 0) return <TrendingDown className="w-3 h-3" />
  return null
}

export function XStockCard({ xstock }: XStockCardProps) {
  const [hasCopied, setHasCopied] = useState(false)

  const onCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(xstock.id)
      setHasCopied(true)
    }
  }

  useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => {
        setHasCopied(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [hasCopied])

  return (
    <Card className="border border-white/10 bg-black/30 backdrop-blur-sm hover:bg-black/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
            <img
              src={xstock.icon}
              alt={xstock.name}
              className="w-full h-full object-cover"
              onError={e => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-white truncate">
              {xstock.symbol}
              <Button
              onClick={onCopy}
              variant="ghost"
              size="icon"
              className="size-5 sm:size-6 shrink-0"
              aria-label="Copy address"
            >
              {hasCopied ? (
                <Check className="size-2 sm:size-3 text-green-500" />
              ) : (
                <Copy className="size-2 sm:size-3" />
              )}
            </Button>
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className="h-5 px-2 text-xs border-emerald-500/50 text-emerald-400 truncate"
              >
                {xstock.name.replace('xStock', '')}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-white/5">
            <div className="text-xs text-blue-200/80 mb-1">Price</div>
            <div className="font-semibold text-sm text-white">
              {formatPrice(xstock.usdPrice)}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/5">
            <div className="text-xs text-blue-200/80 mb-1">MCap</div>
            <div className="font-semibold text-sm text-white">
              {formatMarketCap(xstock.mcap)}
            </div>
          </div>
        </div>

        <div className="text-center p-3 rounded-lg bg-white/5 mb-4">
          <div className="text-xs text-blue-200/80 mb-1">Liquidity</div>
          <div className="font-semibold text-sm text-white">
            {formatLiquidity(xstock.liquidity)}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 mb-2">
            <div className="text-xs text-blue-200/80">5m</div>
            <div
              className={`flex items-center gap-1 text-xs font-semibold ${getPriceChangeColor(
                xstock.stats5m.priceChange
              )}`}
            >
              {getPriceChangeIcon(xstock.stats5m.priceChange)}
              {formatPriceChange(xstock.stats5m.priceChange)}
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 mb-2">
            <div className="text-xs text-blue-200/80">1h</div>
            <div
              className={`flex items-center gap-1 text-xs font-semibold ${getPriceChangeColor(
                xstock.stats1h.priceChange
              )}`}
            >
              {getPriceChangeIcon(xstock.stats1h.priceChange)}
              {formatPriceChange(xstock.stats1h.priceChange)}
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
            <div className="text-xs text-blue-200/80">24h</div>
            <div
              className={`flex items-center gap-1 text-xs font-semibold ${getPriceChangeColor(
                xstock.stats24h.priceChange
              )}`}
            >
              {getPriceChangeIcon(xstock.stats24h.priceChange)}
              {formatPriceChange(xstock.stats24h.priceChange)}
            </div>
          </div>
        </div>

        {/* <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-blue-200/80">
            <span>
              {xstock.id.slice(0, 5)}...{xstock.id.slice(-5)}
            </span>
            <Button
              onClick={onCopy}
              variant="ghost"
              size="icon"
              className="size-5 sm:size-6 shrink-0"
              aria-label="Copy address"
            >
              {hasCopied ? (
                <Check className="size-2 sm:size-3 text-green-500" />
              ) : (
                <Copy className="size-2 sm:size-3" />
              )}
            </Button>
          </div> */}
        {/* </div> */}
      </CardContent>
    </Card>
  )
}

interface XStockGridProps {
  xstocks: XStockData[]
}

export function XStockGrid({ xstocks }: XStockGridProps) {
  if (xstocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <TrendingUp className="w-12 h-12 text-blue-200/50 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">
          No xStocks found
        </h3>
        <p className="text-sm text-blue-200/80">
          Try adjusting your search criteria
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">
              xStocks Available
            </h2>
          </div>
          <p className="text-sm text-blue-200/80">
            Real-world stock tokens available on Solana
          </p>
        </div>

        <Badge
          variant="secondary"
          className="h-8 px-4 bg-white/10 text-white border-white/20 text-sm"
        >
          {xstocks.length} {xstocks.length === 1 ? 'xStock' : 'xStocks'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {xstocks.map(xstock => (
          <XStockCard key={xstock.id} xstock={xstock} />
        ))}
      </div>
    </div>
  )
}

interface XStockListSectionProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function XStockListSection({
  tool,
  isOpen,
  onOpenChange
}: XStockListSectionProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  const header = (
    <ToolArgsSection tool="xstock_list">{`XStock List`}</ToolArgsSection>
  )

  const toolResult = tool.result || {}
  const results = toolResult.data || toolResult || []

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {results.length === 0 && <div>No xStocks found.</div>}
      <XStockGrid xstocks={results} />
    </CollapsibleMessage>
  )
}

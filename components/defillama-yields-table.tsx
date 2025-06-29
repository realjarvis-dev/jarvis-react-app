'use client'

import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { formatTVL, formatAPY } from '../lib/defillama/utils'
import { ExternalLink, Shield, AlertTriangle, TrendingUp } from 'lucide-react'
import type { DeFiLlamaYield } from '../lib/defillama/types'

interface DeFiLlamaYieldsTableProps {
  yields: DeFiLlamaYield[]
}

function getChainColor(chain: string): string {
  const chainColors: Record<string, string> = {
    'Ethereum': 'bg-blue-100 text-blue-800',
    'Arbitrum': 'bg-cyan-100 text-cyan-800', 
    'Polygon': 'bg-purple-100 text-purple-800',
    'Optimism': 'bg-red-100 text-red-800',
    'Base': 'bg-indigo-100 text-indigo-800',
    'Avalanche': 'bg-orange-100 text-orange-800',
    'Binance': 'bg-yellow-100 text-yellow-800',
    'Solana': 'bg-green-100 text-green-800'
  }
  
  return chainColors[chain] || 'bg-gray-100 text-gray-800'
}

function getRiskColor(ilRisk: string, stablecoin: boolean): string {
  if (stablecoin) return 'bg-green-100 text-green-800'
  
  switch (ilRisk?.toLowerCase()) {
    case 'no':
    case 'low':
      return 'bg-green-100 text-green-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'high':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function YieldCard({ yieldData, rank }: { yieldData: DeFiLlamaYield, rank: number }) {
  const totalApy = yieldData.apy || (yieldData.apyBase || 0) + (yieldData.apyReward || 0)
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                #{rank}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {yieldData.project}
                {yieldData.url && (
                  <a 
                    href={yieldData.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getChainColor(yieldData.chain)}>
                  {yieldData.chain}
                </Badge>
                {yieldData.symbol && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {yieldData.symbol}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              {formatAPY(totalApy)}
            </div>
            <div className="text-xs text-muted-foreground">Total APY</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Pool TVL</div>
            <div className="font-semibold">{formatTVL(yieldData.tvlUsd)}</div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">Base APY</div>
            <div className="font-medium text-blue-600">
              {yieldData.apyBase ? formatAPY(yieldData.apyBase) : 'N/A'}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">Reward APY</div>
            <div className="font-medium text-purple-600">
              {yieldData.apyReward ? formatAPY(yieldData.apyReward) : 'N/A'}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">30d Avg APY</div>
            <div className="font-medium">
              {yieldData.apyMean30d ? formatAPY(yieldData.apyMean30d) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Risk and Features */}
        <div className="flex items-center gap-2 mb-3">
          {yieldData.stablecoin && (
            <Badge className="bg-green-100 text-green-800">
              <Shield className="w-3 h-3 mr-1" />
              Stablecoin
            </Badge>
          )}
          
          {yieldData.ilRisk && (
            <Badge className={getRiskColor(yieldData.ilRisk, yieldData.stablecoin)}>
              {yieldData.ilRisk.toLowerCase() === 'no' && <Shield className="w-3 h-3 mr-1" />}
              {yieldData.ilRisk.toLowerCase() !== 'no' && <AlertTriangle className="w-3 h-3 mr-1" />}
              IL Risk: {yieldData.ilRisk}
            </Badge>
          )}

          {yieldData.outlier && (
            <Badge className="bg-orange-100 text-orange-800">
              <TrendingUp className="w-3 h-3 mr-1" />
              Outlier
            </Badge>
          )}
        </div>

        {/* Reward Tokens */}
        {yieldData.rewardTokens && yieldData.rewardTokens.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-1">Reward Tokens</div>
            <div className="flex flex-wrap gap-1">
              {yieldData.rewardTokens.slice(0, 4).map((token, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {token}
                </Badge>
              ))}
              {yieldData.rewardTokens.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{yieldData.rewardTokens.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Volume Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-4">
            {yieldData.volumeUsd1d && (
              <span>24h Vol: {formatTVL(yieldData.volumeUsd1d)}</span>
            )}
            {yieldData.volumeUsd7d && (
              <span>7d Vol: {formatTVL(yieldData.volumeUsd7d)}</span>
            )}
          </div>
          
          {yieldData.exposure && (
            <span>Exposure: {yieldData.exposure}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function DeFiLlamaYieldsTable({ yields }: DeFiLlamaYieldsTableProps) {
  if (yields.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="text-lg font-medium mb-2">No yield opportunities found</div>
        <div className="text-sm">Try adjusting your search criteria</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">💰 Top Yield Opportunities</h2>
          <p className="text-sm text-muted-foreground mt-1">
            High-yield pools sorted by APY. Always DYOR and understand the risks!
          </p>
        </div>
      </div>

      {/* Yield Cards */}
      <div className="grid gap-4">
        {yields.map((yieldData, index) => (
          <YieldCard 
            key={`${yieldData.pool}-${yieldData.chain}`} 
            yieldData={yieldData} 
            rank={index + 1}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t text-center text-xs text-muted-foreground">
        ⚠️ <strong>Risk Warning:</strong> High yields often come with higher risks. 
        Consider impermanent loss, smart contract risk, and token emission schedules.
      </div>
    </div>
  )
}
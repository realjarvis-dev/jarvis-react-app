'use client'

import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { formatTVL, formatAPY, formatRewardToken } from '../lib/defillama/utils'
import { ExternalLink, Shield, AlertTriangle, TrendingUp, Percent, DollarSign } from 'lucide-react'
import type { DeFiLlamaYield } from '../lib/defillama/types'

interface DeFiLlamaYieldsTableProps {
  yields: DeFiLlamaYield[]
}

function getChainColor(chain: string): string {
  const chainColors: Record<string, string> = {
    'Ethereum': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    'Arbitrum': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800', 
    'Polygon': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    'Optimism': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
    'Base': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    'Avalanche': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
    'BSC': 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800',
    'Solana': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  }
  
  return chainColors[chain] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/50 dark:text-gray-300 dark:border-gray-800'
}

function getRiskBadge(yieldData: DeFiLlamaYield) {
  if (yieldData.stablecoin) {
    return (
      <Badge variant="outline" className="h-6 px-3 text-xs border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        <Shield className="w-3 h-3 mr-1" />
        Stablecoin
      </Badge>
    )
  }

  if (yieldData.ilRisk) {
    const isLowRisk = yieldData.ilRisk.toLowerCase() === 'no'
    return (
      <Badge 
        variant="outline" 
        className={`h-6 px-3 text-xs ${
          isLowRisk 
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
        }`}
      >
        {isLowRisk ? <Shield className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
        IL Risk: {yieldData.ilRisk}
      </Badge>
    )
  }

  return null
}

function YieldCard({ yieldData, rank }: { yieldData: DeFiLlamaYield, rank: number }) {
  const totalApy = yieldData.apy || (yieldData.apyBase || 0) + (yieldData.apyReward || 0)
  
  return (
    <Card className="hover:shadow-lg transition-all duration-200 border border-border/50 bg-card">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            {/* Rank Badge */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 via-green-600 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                #{rank}
              </div>
            </div>
            
            {/* Yield Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg text-foreground">
                  {yieldData.project}
                </h3>
                {yieldData.url && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                    <a 
                      href={yieldData.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>
              
              {/* Tags Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant="outline" 
                  className={`h-6 px-3 text-xs font-medium border ${getChainColor(yieldData.chain)}`}
                >
                  {yieldData.chain}
                </Badge>
                
                {yieldData.symbol && (
                  <Badge variant="secondary" className="h-6 px-3 text-xs font-mono">
                    {yieldData.symbol}
                  </Badge>
                )}
                
                {getRiskBadge(yieldData)}
                
                {yieldData.outlier && (
                  <Badge variant="outline" className="h-6 px-3 text-xs border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Outlier
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* APY Display */}
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              {formatAPY(totalApy)}
            </div>
            <div className="text-xs text-muted-foreground">Total APY</div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pool TVL</span>
            </div>
            <div className="font-semibold text-sm">{formatTVL(yieldData.tvlUsd)}</div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Percent className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Base APY</span>
            </div>
            <div className="font-semibold text-sm text-blue-600">
              {yieldData.apyBase ? formatAPY(yieldData.apyBase) : 'N/A'}
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Reward APY</span>
            </div>
            <div className="font-semibold text-sm text-purple-600">
              {yieldData.apyReward ? formatAPY(yieldData.apyReward) : 'N/A'}
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground">30d Avg</span>
            </div>
            <div className="font-semibold text-sm">
              {yieldData.apyMean30d ? formatAPY(yieldData.apyMean30d) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Reward Tokens */}
        {yieldData.rewardTokens && yieldData.rewardTokens.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2">Reward Tokens</div>
            <div className="flex flex-wrap gap-1">
              {yieldData.rewardTokens.slice(0, 4).map((token, index) => (
                <Badge key={index} variant="outline" className="h-6 px-2 text-xs font-mono">
                  {formatRewardToken(token)}
                </Badge>
              ))}
              {yieldData.rewardTokens.length > 4 && (
                <Badge variant="outline" className="h-6 px-2 text-xs">
                  +{yieldData.rewardTokens.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {yieldData.exposure && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Exposure: {yieldData.exposure}
              </span>
            )}
            {yieldData.poolMeta && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {yieldData.poolMeta}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {yieldData.volumeUsd1d && (
                <span>24h Vol: {formatTVL(yieldData.volumeUsd1d)}</span>
              )}
              {yieldData.volumeUsd7d && (
                <span>7d Vol: {formatTVL(yieldData.volumeUsd7d)}</span>
              )}
            </div>
            
            {yieldData.url && (
              <Button variant="outline" size="sm" asChild>
                <a 
                  href={yieldData.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-medium"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View Opportunity
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DeFiLlamaYieldsTable({ yields }: DeFiLlamaYieldsTableProps) {
  if (yields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Percent className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No yield opportunities found</h3>
        <p className="text-sm text-muted-foreground">Try adjusting your search criteria</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-foreground">
              High-Yield Opportunities
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Top yield farming and staking opportunities across DeFi protocols
          </p>
        </div>
        
        <Badge variant="secondary" className="h-8 px-4">
          {yields.length} opportunity{yields.length > 1 ? 'ies' : 'y'}
        </Badge>
      </div>

      {/* Yield Cards Grid */}
      <div className="grid gap-4">
        {yields.map((yieldData, index) => (
          <YieldCard 
            key={`${yieldData.pool}-${yieldData.chain}`} 
            yieldData={yieldData} 
            rank={index + 1}
          />
        ))}
      </div>

      {/* Footer Warning */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
              Risk Disclosure
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              High yields often involve increased risks including impermanent loss, smart contract vulnerabilities, 
              and token emission schedules. Always DYOR and consider your risk tolerance before investing.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
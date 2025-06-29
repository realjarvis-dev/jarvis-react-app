'use client'

import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { formatTVL, formatPercentage, getCategoryColor, getChangeColor } from '../lib/defillama/utils'
import { ExternalLink, TrendingUp, TrendingDown, Minus, Shield, BarChart3 } from 'lucide-react'
import type { DeFiLlamaProtocol } from '../lib/defillama/types'

interface DeFiLlamaProtocolsTableProps {
  protocols: DeFiLlamaProtocol[]
  view: string
}

function getTrendIcon(change: number | null, size = 16) {
  if (change === null || change === undefined) {
    return <Minus className={`w-${size/4} h-${size/4} text-muted-foreground`} />
  }
  return change >= 0 
    ? <TrendingUp className={`w-${size/4} h-${size/4} text-emerald-600`} />
    : <TrendingDown className={`w-${size/4} h-${size/4} text-red-600`} />
}

function ProtocolCard({ protocol, rank }: { protocol: DeFiLlamaProtocol, rank: number }) {
  return (
    <Card className="hover:shadow-lg transition-all duration-200 border border-border/50 bg-card">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            {/* Rank Badge */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                #{rank}
              </div>
            </div>
            
            {/* Protocol Info */}
            <div className="flex items-center space-x-3 min-w-0">
              {protocol.logo && (
                <div className="flex-shrink-0">
                  <img 
                    src={protocol.logo} 
                    alt={protocol.name}
                    className="w-10 h-10 rounded-full border-2 border-border/20"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg text-foreground truncate">
                    {protocol.name}
                  </h3>
                  {protocol.url && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                      <a 
                        href={protocol.url} 
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
                    className={`h-6 px-3 text-xs font-medium border ${getCategoryColor(protocol.category)}`}
                  >
                    {protocol.category}
                  </Badge>
                  
                  {protocol.chains.length > 0 && (
                    <Badge variant="secondary" className="h-6 px-3 text-xs">
                      {protocol.chains.length === 1 
                        ? protocol.chains[0] 
                        : `${protocol.chains.length} chains`
                      }
                    </Badge>
                  )}
                  
                  {protocol.audits && parseInt(protocol.audits) > 0 && (
                    <Badge variant="outline" className="h-6 px-3 text-xs border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <Shield className="w-3 h-3 mr-1" />
                      {protocol.audits} audit{parseInt(protocol.audits) > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* TVL Display */}
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 text-2xl font-bold text-foreground mb-1">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              {formatTVL(protocol.tvl)}
            </div>
            <div className="text-xs text-muted-foreground">Total Value Locked</div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-6 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {getTrendIcon(protocol.change_1h)}
              <span className="text-xs text-muted-foreground">1h</span>
            </div>
            <div className={`font-semibold text-sm ${getChangeColor(protocol.change_1h)}`}>
              {formatPercentage(protocol.change_1h)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {getTrendIcon(protocol.change_1d)}
              <span className="text-xs text-muted-foreground">24h</span>
            </div>
            <div className={`font-semibold text-sm ${getChangeColor(protocol.change_1d)}`}>
              {formatPercentage(protocol.change_1d)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {getTrendIcon(protocol.change_7d)}
              <span className="text-xs text-muted-foreground">7d</span>
            </div>
            <div className={`font-semibold text-sm ${getChangeColor(protocol.change_7d)}`}>
              {formatPercentage(protocol.change_7d)}
            </div>
          </div>
        </div>

        {/* Description */}
        {protocol.description && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {protocol.description}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {protocol.chains.length > 1 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {protocol.chains.slice(0, 3).join(', ')}
                {protocol.chains.length > 3 && ` +${protocol.chains.length - 3}`}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {protocol.mcap && (
              <span className="text-xs text-muted-foreground">
                MCap: {formatTVL(protocol.mcap)}
              </span>
            )}
            {protocol.twitter && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                <a 
                  href={`https://twitter.com/${protocol.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  @{protocol.twitter}
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DeFiLlamaProtocolsTable({ protocols, view }: DeFiLlamaProtocolsTableProps) {
  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No protocols found</h3>
        <p className="text-sm text-muted-foreground">Try adjusting your search criteria</p>
      </div>
    )
  }

  const getViewTitle = () => {
    switch (view) {
      case 'top_gainers':
        return {
          title: 'Top Performing Protocols',
          subtitle: 'Protocols with highest 7-day growth and TVL > $1M',
          icon: <TrendingUp className="w-5 h-5 text-emerald-600" />
        }
      case 'top_tvl':
        return {
          title: 'Market Leaders',
          subtitle: 'Protocols ranked by Total Value Locked',
          icon: <BarChart3 className="w-5 h-5 text-blue-600" />
        }
      case 'custom':
        return {
          title: 'Filtered Results',
          subtitle: 'Protocols matching your search criteria',
          icon: <BarChart3 className="w-5 h-5 text-purple-600" />
        }
      default:
        return {
          title: 'DeFi Protocols',
          subtitle: 'Decentralized Finance protocol analysis',
          icon: <BarChart3 className="w-5 h-5 text-gray-600" />
        }
    }
  }

  const viewInfo = getViewTitle()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {viewInfo.icon}
            <h2 className="text-xl font-semibold text-foreground">
              {viewInfo.title}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {viewInfo.subtitle}
          </p>
        </div>
        
        <Badge variant="secondary" className="h-8 px-4">
          {protocols.length} protocol{protocols.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Protocol Cards Grid */}
      <div className="grid gap-4">
        {protocols.map((protocol, index) => (
          <ProtocolCard 
            key={protocol.id} 
            protocol={protocol} 
            rank={index + 1}
          />
        ))}
      </div>

      {/* Footer Tip */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/50">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Investment Insight
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              High TVL growth often indicates capital flowing to protocols for fundamental reasons. 
              Research protocol tokenomics, recent partnerships, and development activity to understand the opportunity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
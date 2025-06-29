'use client'

import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { formatTVL, formatPercentage, getCategoryColor, getChangeColor } from '../lib/defillama/utils'
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DeFiLlamaProtocol } from '../lib/defillama/types'

interface DeFiLlamaProtocolsTableProps {
  protocols: DeFiLlamaProtocol[]
  view: string
}

function getTrendIcon(change: number | null) {
  if (change === null || change === undefined) {
    return <Minus className="w-3 h-3 text-gray-400" />
  }
  return change >= 0 
    ? <TrendingUp className="w-3 h-3 text-green-500" />
    : <TrendingDown className="w-3 h-3 text-red-500" />
}

function ProtocolCard({ protocol, rank }: { protocol: DeFiLlamaProtocol, rank: number }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                #{rank}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {protocol.logo && (
                <img 
                  src={protocol.logo} 
                  alt={protocol.name}
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  {protocol.name}
                  {protocol.url && (
                    <a 
                      href={protocol.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getCategoryColor(protocol.category)}>
                    {protocol.category}
                  </Badge>
                  {protocol.chains.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {protocol.chains.slice(0, 2).join(', ')}
                      {protocol.chains.length > 2 && ` +${protocol.chains.length - 2}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">TVL</div>
            <div className="font-semibold text-lg">{formatTVL(protocol.tvl)}</div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              1h {getTrendIcon(protocol.change_1h)}
            </div>
            <div className={`font-medium ${getChangeColor(protocol.change_1h)}`}>
              {formatPercentage(protocol.change_1h)}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              24h {getTrendIcon(protocol.change_1d)}
            </div>
            <div className={`font-medium ${getChangeColor(protocol.change_1d)}`}>
              {formatPercentage(protocol.change_1d)}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              7d {getTrendIcon(protocol.change_7d)}
            </div>
            <div className={`font-medium ${getChangeColor(protocol.change_7d)}`}>
              {formatPercentage(protocol.change_7d)}
            </div>
          </div>
        </div>

        {protocol.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {protocol.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {protocol.audits && parseInt(protocol.audits) > 0 && (
              <span className="flex items-center gap-1">
                🛡️ {protocol.audits} audit{parseInt(protocol.audits) > 1 ? 's' : ''}
              </span>
            )}
            {protocol.twitter && (
              <a 
                href={`https://twitter.com/${protocol.twitter}`}
                target="_blank"
                rel="noopener noreferrer" 
                className="text-blue-500 hover:text-blue-600"
              >
                @{protocol.twitter}
              </a>
            )}
          </div>
          
          {protocol.mcap && (
            <span>MCap: {formatTVL(protocol.mcap)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function DeFiLlamaProtocolsTable({ protocols, view }: DeFiLlamaProtocolsTableProps) {
  if (protocols.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="text-lg font-medium mb-2">No protocols found</div>
        <div className="text-sm">Try adjusting your search criteria</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {view === 'top_gainers' && '🚀 Top Gainers - Follow the Money!'}
            {view === 'top_tvl' && '👑 TVL Leaders - The Biggest Players'}
            {view === 'custom' && '🎯 Your Custom Search Results'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {view === 'top_gainers' && 'Protocols with highest 7-day growth and TVL > $1M'}
            {view === 'top_tvl' && 'Protocols ranked by Total Value Locked'}
            {view === 'custom' && 'Filtered protocols matching your criteria'}
          </p>
        </div>
      </div>

      {/* Protocol Cards */}
      <div className="grid gap-4">
        {protocols.map((protocol, index) => (
          <ProtocolCard 
            key={protocol.id} 
            protocol={protocol} 
            rank={index + 1}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t text-center text-xs text-muted-foreground">
        💡 <strong>Pro tip:</strong> High TVL growth often indicates money flowing to protocols for a reason. 
        Research why these protocols are gaining traction to find opportunities!
      </div>
    </div>
  )
}
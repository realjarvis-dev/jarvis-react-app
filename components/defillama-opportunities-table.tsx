'use client'

import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { formatTVL, formatPercentage, formatAPY, getCategoryColor, getRiskColor, getMomentumColor, getChangeColor } from '../lib/defillama/utils'
import { ExternalLink, ChevronDown, ChevronRight, TrendingUp, Target, Shield, Zap } from 'lucide-react'
import { useState } from 'react'
import type { DeFiOpportunity } from '../lib/defillama/types'

interface DeFiLlamaOpportunitiesTableProps {
  opportunities: DeFiOpportunity[]
  includeYields: boolean
}

function OpportunityCard({ opportunity, rank, includeYields }: { 
  opportunity: DeFiOpportunity
  rank: number
  includeYields: boolean 
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { protocol, opportunities: oppData } = opportunity

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardContent className="p-0">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className="w-full p-4 text-left hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 via-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    #{rank}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {protocol.logo && (
                    <img 
                      src={protocol.logo} 
                      alt={protocol.name}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div>
                    <h3 className="font-bold text-xl flex items-center gap-2">
                      {protocol.name}
                      {protocol.url && (
                        <a 
                          href={protocol.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getCategoryColor(protocol.category)}>
                        {protocol.category}
                      </Badge>
                      <Badge className={getRiskColor(oppData.riskLevel)}>
                        <Shield className="w-3 h-3 mr-1" />
                        {oppData.riskLevel} risk
                      </Badge>
                      <Badge className={getMomentumColor(oppData.momentum)}>
                        <Zap className="w-3 h-3 mr-1" />
                        {oppData.momentum}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    +{oppData.tvlGrowth.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">7d Growth</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">{formatTVL(protocol.tvl)}</div>
                  <div className="text-xs text-muted-foreground">TVL</div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4 border-t">
              {/* Protocol Details */}
              <div className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">1h Change</div>
                    <div className={`font-medium ${getChangeColor(protocol.change_1h)}`}>
                      {formatPercentage(protocol.change_1h)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">24h Change</div>
                    <div className={`font-medium ${getChangeColor(protocol.change_1d)}`}>
                      {formatPercentage(protocol.change_1d)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
                    <div className="font-medium">
                      {protocol.mcap ? formatTVL(protocol.mcap) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Audits</div>
                    <div className="font-medium">
                      {protocol.audits && parseInt(protocol.audits) > 0 
                        ? `${protocol.audits} audit${parseInt(protocol.audits) > 1 ? 's' : ''}`
                        : 'Unaudited'
                      }
                    </div>
                  </div>
                </div>

                {protocol.description && (
                  <div className="mb-4">
                    <div className="text-sm font-medium mb-2">🎯 What is {protocol.name}?</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {protocol.description}
                    </p>
                  </div>
                )}

                {/* Chain Distribution */}
                {protocol.chains.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium mb-2">🌐 Available Chains</div>
                    <div className="flex flex-wrap gap-1">
                      {protocol.chains.slice(0, 8).map((chain, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {chain}
                        </Badge>
                      ))}
                      {protocol.chains.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{protocol.chains.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Why It's Growing */}
                <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-lg mb-4">
                  <div className="text-sm font-medium text-green-900 dark:text-green-100 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Why Money is Flowing Here
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300">
                    <div className="mb-1">• <strong>{oppData.tvlGrowth.toFixed(1)}%</strong> TVL growth in 7 days</div>
                    <div className="mb-1">• <strong>{oppData.momentum}</strong> momentum with <strong>{oppData.riskLevel}</strong> risk profile</div>
                    <div>• Part of the growing <strong>{protocol.category}</strong> sector</div>
                  </div>
                </div>

                {/* Yield Opportunities */}
                {includeYields && oppData.yieldOpportunities.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      💰 Related Yield Opportunities
                    </div>
                    <div className="space-y-2">
                      {oppData.yieldOpportunities.slice(0, 3).map((yieldData, index) => (
                        <div key={index} className="p-2 bg-muted/30 rounded-md text-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{yieldData.symbol}</div>
                              <div className="text-xs text-muted-foreground">
                                {yieldData.chain} • {formatTVL(yieldData.tvlUsd)} TVL
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">
                                {formatAPY(yieldData.apy)}
                              </div>
                              <div className="text-xs text-muted-foreground">APY</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
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
                  {protocol.methodology && (
                    <span className="text-xs">TVL Methodology Available</span>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

export function DeFiLlamaOpportunitiesTable({ opportunities, includeYields }: DeFiLlamaOpportunitiesTableProps) {
  if (opportunities.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="text-lg font-medium mb-2">No opportunities found</div>
        <div className="text-sm">Try adjusting your search criteria</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">🎯 DeFi Opportunity Hunter Results</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Protocols with high TVL growth - click to expand and see why money is flowing there
          </p>
        </div>
      </div>

      {/* Opportunity Cards */}
      <div className="space-y-3">
        {opportunities.map((opportunity, index) => (
          <OpportunityCard 
            key={opportunity.protocol.id} 
            opportunity={opportunity} 
            rank={index + 1}
            includeYields={includeYields}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t text-center text-xs text-muted-foreground">
        💡 <strong>Investment Insight:</strong> These protocols are experiencing significant capital inflow. 
        Research their fundamentals, tokenomics, and recent developments to understand the opportunity.
        Always DYOR and consider your risk tolerance! 🚀
      </div>
    </div>
  )
}
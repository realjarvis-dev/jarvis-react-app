'use client'

import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { formatTVL, formatPercentage, formatAPY, getCategoryColor, getRiskColor, getMomentumColor, getChangeColor } from '../lib/defillama/utils'
import { ExternalLink, ChevronDown, ChevronRight, TrendingUp, Target, Shield, Zap, BarChart3, Percent } from 'lucide-react'
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
    <Card className="hover:shadow-lg transition-all duration-200 border border-border/50 bg-card">
      <CardContent className="p-0">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className="w-full p-6 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
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
                      <h3 className="font-bold text-xl text-foreground truncate">
                        {protocol.name}
                      </h3>
                      {protocol.url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0" 
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
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
                    
                    {/* Status Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={`h-6 px-3 text-xs font-medium border ${getCategoryColor(protocol.category)}`}
                      >
                        {protocol.category}
                      </Badge>
                      
                      <Badge 
                        variant="outline" 
                        className={`h-6 px-3 text-xs border ${getRiskColor(oppData.riskLevel)}`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {oppData.riskLevel} risk
                      </Badge>
                      
                      <Badge 
                        variant="outline" 
                        className={`h-6 px-3 text-xs border ${getMomentumColor(oppData.momentum)}`}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        {oppData.momentum}
                      </Badge>
                      
                      {includeYields && oppData.yieldOpportunities.length > 0 && (
                        <Badge variant="secondary" className="h-6 px-3 text-xs">
                          <Percent className="w-3 h-3 mr-1" />
                          {oppData.yieldOpportunities.length} yield{oppData.yieldOpportunities.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Metrics Display */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    +{oppData.tvlGrowth.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">7d Growth</div>
                </div>
                
                <div className="text-right">
                  <div className="text-xl font-bold text-foreground">
                    {formatTVL(protocol.tvl)}
                  </div>
                  <div className="text-xs text-muted-foreground">TVL</div>
                </div>
                
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-6 pb-6 space-y-6 border-t border-border/50">
              {/* Detailed Metrics */}
              <div className="pt-6">
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Performance Metrics
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">1h Change</div>
                    <div className={`font-semibold ${getChangeColor(protocol.change_1h)}`}>
                      {formatPercentage(protocol.change_1h)}
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">24h Change</div>
                    <div className={`font-semibold ${getChangeColor(protocol.change_1d)}`}>
                      {formatPercentage(protocol.change_1d)}
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
                    <div className="font-semibold">
                      {protocol.mcap ? formatTVL(protocol.mcap) : 'N/A'}
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Audits</div>
                    <div className="font-semibold">
                      {protocol.audits && parseInt(protocol.audits) > 0 
                        ? `${protocol.audits} audit${parseInt(protocol.audits) > 1 ? 's' : ''}`
                        : 'Unaudited'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Protocol Description */}
              {protocol.description && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    About {protocol.name}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {protocol.description}
                  </p>
                </div>
              )}

              {/* Chain Distribution */}
              {protocol.chains.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Available Networks</h4>
                  <div className="flex flex-wrap gap-2">
                    {protocol.chains.slice(0, 8).map((chain, index) => (
                      <Badge key={index} variant="outline" className="h-6 px-3 text-xs">
                        {chain}
                      </Badge>
                    ))}
                    {protocol.chains.length > 8 && (
                      <Badge variant="outline" className="h-6 px-3 text-xs">
                        +{protocol.chains.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Investment Thesis */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                      Investment Thesis
                    </h4>
                    <div className="space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                      <div>• <strong>{oppData.tvlGrowth.toFixed(1)}%</strong> TVL growth indicates strong capital inflow</div>
                      <div>• <strong>{oppData.momentum}</strong> momentum with <strong>{oppData.riskLevel}</strong> risk assessment</div>
                      <div>• Operating in the <strong>{protocol.category}</strong> sector with growth potential</div>
                      {protocol.audits && parseInt(protocol.audits) > 0 && (
                        <div>• Security validated through <strong>{protocol.audits}</strong> professional audit{parseInt(protocol.audits) > 1 ? 's' : ''}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Yield Opportunities */}
              {includeYields && oppData.yieldOpportunities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Related Yield Opportunities
                  </h4>
                  <div className="space-y-3">
                    {oppData.yieldOpportunities.slice(0, 3).map((yieldData, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-foreground">
                            {yieldData.symbol || 'Unknown Pool'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {yieldData.chain} • {formatTVL(yieldData.tvlUsd)} TVL
                            {yieldData.stablecoin && ' • Stablecoin'}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                            {formatAPY(yieldData.apy)}
                          </div>
                          <div className="text-xs text-muted-foreground">APY</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Links */}
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {protocol.methodology && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      TVL Methodology Available
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
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
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Target className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No opportunities found</h3>
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
            <Target className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold text-foreground">
              DeFi Investment Opportunities
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            High-growth protocols with significant capital inflow and momentum analysis
          </p>
        </div>
        
        <Badge variant="secondary" className="h-8 px-4">
          {opportunities.length} opportunity{opportunities.length > 1 ? 'ies' : 'y'}
        </Badge>
      </div>

      {/* Opportunity Cards */}
      <div className="space-y-4">
        {opportunities.map((opportunity, index) => (
          <OpportunityCard 
            key={opportunity.protocol.id} 
            opportunity={opportunity} 
            rank={index + 1}
            includeYields={includeYields}
          />
        ))}
      </div>

      {/* Footer Insight */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/50">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Research Recommendations
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              These protocols show significant capital inflow indicating institutional or whale interest. 
              Research recent protocol updates, partnership announcements, token unlock schedules, and governance proposals 
              to understand the fundamental drivers behind the growth.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
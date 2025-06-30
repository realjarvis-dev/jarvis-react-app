'use client'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { formatTVL, formatPercentage, formatAPY, formatRewardToken, getCategoryColor } from '../lib/defillama/utils'
import { ExternalLink, ChevronDown, ChevronRight, TrendingUp, Target, Shield, Zap, BarChart3, Percent } from 'lucide-react'
import { useState } from 'react'
import type { DeFiOpportunity } from '../lib/defillama/types'

interface DeFiLlamaOpportunitiesTableProps {
  opportunities: DeFiOpportunity[]
  includeYields: boolean
}

function OpportunityRow({ opportunity, includeYields }: { 
  opportunity: DeFiOpportunity
  includeYields: boolean 
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { protocol, opportunities: oppData } = opportunity

  return (
    <>
      <TableRow 
        className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="p-3">
          <div className="flex items-center gap-2">
            {protocol.logo && (
              <img 
                src={protocol.logo} 
                alt={protocol.name}
                className="w-6 h-6 rounded-full border border-white/20"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <div>
              <div className="text-sm font-medium text-white">
                {protocol.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className="h-4 px-1.5 text-xs border-blue-500/50 text-blue-400"
                >
                  {protocol.category}
                </Badge>
                {includeYields && oppData.yieldOpportunities.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-xs border-purple-500/50 text-purple-400">
                    {oppData.yieldOpportunities.length} yield{oppData.yieldOpportunities.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right p-3 text-sm font-semibold">
          {formatTVL(protocol.tvl)}
        </TableCell>
        <TableCell className="text-right p-3 text-sm font-semibold">
          <span className="text-emerald-400">
            +{oppData.tvlGrowth.toFixed(1)}%
          </span>
        </TableCell>
        <TableCell className="text-right p-3 text-sm">
          <div className="flex items-center justify-end gap-2">
            {oppData.riskLevel === 'low' && (
              <Badge variant="outline" className="h-5 px-2 text-xs border-emerald-500/50 text-emerald-400">
                <Shield className="w-3 h-3 mr-1" />
                Low
              </Badge>
            )}
            {oppData.riskLevel === 'medium' && (
              <Badge variant="outline" className="h-5 px-2 text-xs border-yellow-500/50 text-yellow-400">
                Medium
              </Badge>
            )}
            {oppData.riskLevel === 'high' && (
              <Badge variant="outline" className="h-5 px-2 text-xs border-red-500/50 text-red-400">
                High
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={`h-5 px-2 text-xs ${
                oppData.momentum === 'strong' ? 'border-emerald-500/50 text-emerald-400' :
                oppData.momentum === 'moderate' ? 'border-blue-500/50 text-blue-400' :
                'border-orange-500/50 text-orange-400'
              }`}
            >
              <Zap className="w-3 h-3 mr-1" />
              {oppData.momentum}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="text-center p-3 w-16">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 mx-auto" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 mx-auto" />
          )}
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow className="border-b border-white/10">
          <TableCell colSpan={5} className="p-0">
            <div className="p-4 bg-black/20 border-t border-white/5">
              {/* Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">1h Change</div>
                  <div className={`font-semibold text-sm ${protocol.change_1h && protocol.change_1h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {protocol.change_1h ? `${protocol.change_1h.toFixed(2)}%` : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">24h Change</div>
                  <div className={`font-semibold text-sm ${protocol.change_1d && protocol.change_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {protocol.change_1d ? `${protocol.change_1d.toFixed(2)}%` : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">Market Cap</div>
                  <div className="font-semibold text-sm text-white">
                    {protocol.mcap ? formatTVL(protocol.mcap) : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">Audits</div>
                  <div className="font-semibold text-sm text-white">
                    {protocol.audits && parseInt(protocol.audits) > 0 
                      ? `${protocol.audits} audit${parseInt(protocol.audits) > 1 ? 's' : ''}`
                      : 'Unaudited'
                    }
                  </div>
                </div>
              </div>

              {/* Chains */}
              {protocol.chains.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-blue-200/80 mb-2">Available Networks</div>
                  <div className="flex flex-wrap gap-1">
                    {protocol.chains.slice(0, 8).map((chain, index) => (
                      <Badge key={index} variant="outline" className="h-5 px-2 text-xs border-white/20 text-white">
                        {chain}
                      </Badge>
                    ))}
                    {protocol.chains.length > 8 && (
                      <Badge variant="outline" className="h-5 px-2 text-xs border-white/20 text-white">
                        +{protocol.chains.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Investment Thesis */}
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-emerald-100 mb-2">
                      Investment Thesis
                    </h4>
                    <div className="space-y-1 text-xs text-emerald-200/80">
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
                <div className="mb-4">
                  <div className="text-xs text-blue-200/80 mb-2">Related Yield Opportunities</div>
                  <div className="space-y-2">
                    {oppData.yieldOpportunities.slice(0, 3).map((yieldData, index) => (
                      <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-white">
                              {yieldData.symbol || 'Unknown Pool'}
                            </div>
                            <div className="text-xs text-blue-200/80 mt-1">
                              {yieldData.chain} • {formatTVL(yieldData.tvlUsd)} TVL
                              {yieldData.stablecoin && ' • Stablecoin'}
                            </div>
                            {/* Reward Tokens */}
                            {yieldData.rewardTokens && yieldData.rewardTokens.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                <span className="text-xs text-blue-200/80">Rewards:</span>
                                <div className="flex flex-wrap gap-1">
                                  {yieldData.rewardTokens.slice(0, 3).map((token, tokenIndex) => (
                                    <Badge key={tokenIndex} variant="outline" className="h-4 px-1.5 text-xs font-mono border-white/20 text-white">
                                      {formatRewardToken(token)}
                                    </Badge>
                                  ))}
                                  {yieldData.rewardTokens.length > 3 && (
                                    <Badge variant="outline" className="h-4 px-1.5 text-xs border-white/20 text-white">
                                      +{yieldData.rewardTokens.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <div className="font-bold text-lg text-emerald-400">
                                {formatAPY(yieldData.apy)}
                              </div>
                              <div className="text-xs text-blue-200/80">APY</div>
                            </div>
                            {yieldData.url && (
                              <Button variant="outline" size="sm" asChild className="h-7 px-3 text-xs border-white/20 text-white hover:bg-white/10">
                                <a 
                                  href={yieldData.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-4 text-xs text-blue-200/80">
                  {protocol.methodology && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      TVL Methodology Available
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  {protocol.url && (
                    <Button variant="outline" size="sm" asChild className="h-7 px-3 text-xs border-white/20 text-white hover:bg-white/10">
                      <a 
                        href={protocol.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Protocol
                      </a>
                    </Button>
                  )}
                  {protocol.twitter && (
                    <Button variant="outline" size="sm" asChild className="h-7 px-3 text-xs border-white/20 text-white hover:bg-white/10">
                      <a 
                        href={`https://twitter.com/${protocol.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{protocol.twitter}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function DeFiLlamaOpportunitiesTable({ opportunities, includeYields }: DeFiLlamaOpportunitiesTableProps) {
  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Target className="w-12 h-12 text-blue-200/50 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No opportunities found</h3>
        <p className="text-sm text-blue-200/80">Try adjusting your search criteria</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">
              DeFi Investment Opportunities
            </h2>
          </div>
          <p className="text-sm text-blue-200/80">
            High-growth protocols with significant capital inflow and momentum analysis
          </p>
        </div>
        
        <Badge variant="secondary" className="h-8 px-4 bg-white/10 text-white border-white/20">
          {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}
        </Badge>
      </div>

      {/* Opportunities Table */}
      <div className="table-container rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-4">
        <Table className="w-full border-collapse min-w-[640px]">
          <TableHeader>
            <TableRow className="border-b border-white/10">
              <TableHead className="p-3 font-normal text-sm text-blue-200/80">
                Protocol
              </TableHead>
              <TableHead className="p-3 font-normal text-sm text-blue-200/80 text-right">
                TVL
              </TableHead>
              <TableHead className="p-3 font-normal text-sm text-blue-200/80 text-right whitespace-nowrap">
                7d Growth
              </TableHead>
              <TableHead className="p-3 font-normal text-sm text-blue-200/80 text-right">
                Risk & Momentum
              </TableHead>
              <TableHead className="p-3 font-normal text-sm text-blue-200/80 text-center w-16">
                Details
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((opportunity, index) => (
              <OpportunityRow 
                key={opportunity.protocol.id} 
                opportunity={opportunity} 
                includeYields={includeYields}
              />
            ))}
          </TableBody>
        </Table>
        <style jsx>{`
          .table-container {
            width: 100%;
            overflow-x: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
          }
          .table-container::-webkit-scrollbar {
            height: 8px;
          }
          .table-container::-webkit-scrollbar-track {
            background: transparent;
          }
          .table-container::-webkit-scrollbar-thumb {
            background-color: rgba(155, 155, 155, 0.5);
            border-radius: 20px;
          }
        `}</style>
      </div>

      {/* Footer Insight */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-blue-100 mb-1">
              Research Recommendations
            </h4>
            <p className="text-xs text-blue-200/80 leading-relaxed">
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
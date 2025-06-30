'use client'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { RewardTokenBadge } from './reward-token-badge'
import { ProtocolLink } from './protocol-link'
import { formatTVL, formatAPY } from '../lib/defillama/utils'
import { ExternalLink, Shield, AlertTriangle, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { DeFiLlamaYield } from '../lib/defillama/types'

interface DeFiLlamaYieldsTableProps {
  yields: DeFiLlamaYield[]
  protocolAnalysis?: any[]
  isProtocolSpecific?: boolean
  hasHighYieldPools?: boolean
  searchedProtocol?: string
  highYieldThreshold?: number
}

function getChainColor(chain: string): string {
  const chainColors: Record<string, string> = {
    'Ethereum': 'text-blue-400',
    'Arbitrum': 'text-cyan-400', 
    'Polygon': 'text-purple-400',
    'Optimism': 'text-red-400',
    'Base': 'text-indigo-400',
    'Avalanche': 'text-orange-400',
    'BSC': 'text-yellow-400',
    'Solana': 'text-emerald-400'
  }
  
  return chainColors[chain] || 'text-gray-400'
}

function YieldRow({ yieldData }: { yieldData: DeFiLlamaYield }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const totalApy = yieldData.apy || (yieldData.apyBase || 0) + (yieldData.apyReward || 0)
  
  return (
    <>
      <TableRow 
        className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs md:text-sm font-medium text-white truncate" title={yieldData.project}>
                <ProtocolLink protocolName={yieldData.project} />
              </div>
              <div className="flex items-center gap-1 md:gap-2 mt-0.5 md:mt-1">
                <span className={`text-[10px] md:text-xs ${getChainColor(yieldData.chain)} truncate`} title={yieldData.chain}>
                  {yieldData.chain}
                </span>
                {yieldData.symbol && (
                  <span className="text-[10px] md:text-xs text-gray-400 truncate" title={yieldData.symbol}>
                    {yieldData.symbol}
                  </span>
                )}
              </div>
              {/* Mobile: Show TVL below project name */}
              <div className="sm:hidden mt-1">
                <span className="text-xs text-blue-200/80">
                  TVL: {formatTVL(yieldData.tvlUsd)}
                </span>
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right p-2 md:p-3 text-xs md:text-sm font-semibold hidden sm:table-cell">
          <div className="break-words">
            {formatTVL(yieldData.tvlUsd)}
          </div>
        </TableCell>
        <TableCell className="text-right p-2 md:p-3 text-xs md:text-sm font-semibold">
          <span className="text-green-400">
            {formatAPY(totalApy)}
          </span>
        </TableCell>
        <TableCell className="text-right p-2 md:p-3 text-xs md:text-sm">
          <div className="flex items-center justify-end gap-1">
            {yieldData.stablecoin && (
              <Badge variant="outline" className="h-4 md:h-5 px-1 md:px-2 text-[10px] md:text-xs border-emerald-500/50 text-emerald-400 flex-shrink-0">
                <Shield className="w-2 h-2 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                <span className="hidden sm:inline">Stable</span>
                <span className="sm:hidden">S</span>
              </Badge>
            )}
            {yieldData.ilRisk && yieldData.ilRisk.toLowerCase() !== 'no' && (
              <Badge variant="outline" className="h-4 md:h-5 px-1 md:px-2 text-[10px] md:text-xs border-amber-500/50 text-amber-400 flex-shrink-0">
                <AlertTriangle className="w-2 h-2 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                <span className="hidden sm:inline">IL Risk</span>
                <span className="sm:hidden">IL</span>
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center p-2 md:p-3 w-12 md:w-16">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mx-auto" />
          ) : (
            <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mx-auto" />
          )}
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow className="border-b border-white/10">
          <TableCell colSpan={5} className="p-0">
            <div className="p-2 md:p-4 bg-black/20 border-t border-white/5">
              {/* Detailed Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4">
                <div className="text-center p-2 md:p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">Base APY</div>
                  <div className="font-semibold text-xs md:text-sm text-blue-400">
                    {yieldData.apyBase ? formatAPY(yieldData.apyBase) : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-2 md:p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">Reward APY</div>
                  <div className="font-semibold text-xs md:text-sm text-purple-400">
                    {yieldData.apyReward ? formatAPY(yieldData.apyReward) : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-2 md:p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">30d Average</div>
                  <div className="font-semibold text-xs md:text-sm text-white">
                    {yieldData.apyMean30d ? formatAPY(yieldData.apyMean30d) : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-2 md:p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">24h Volume</div>
                  <div className="font-semibold text-xs md:text-sm text-white">
                    {yieldData.volumeUsd1d ? formatTVL(yieldData.volumeUsd1d) : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Reward Tokens */}
              {yieldData.rewardTokens && yieldData.rewardTokens.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-blue-200/80 mb-2">Reward Tokens</div>
                  <div className="flex flex-wrap gap-1">
                    {yieldData.rewardTokens.slice(0, 6).map((token, index) => (
                      <RewardTokenBadge 
                        key={index} 
                        token={token} 
                        chain={yieldData.chain?.toLowerCase() || 'ethereum'}
                        className="h-5 px-2"
                      />
                    ))}
                    {yieldData.rewardTokens.length > 6 && (
                      <Badge variant="outline" className="h-5 px-2 text-xs border-white/20 text-white">
                        +{yieldData.rewardTokens.length - 6} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Info */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-4 text-xs text-blue-200/80">
                  {yieldData.exposure && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      Exposure: {yieldData.exposure}
                    </span>
                  )}
                  {yieldData.poolMeta && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      {yieldData.poolMeta}
                    </span>
                  )}
                </div>
                
                {yieldData.url && (
                  <Button variant="outline" size="sm" asChild className="h-7 px-3 text-xs border-white/20 text-white hover:bg-white/10">
                    <a 
                      href={yieldData.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View Opportunity
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function DeFiLlamaYieldsTable({ 
  yields, 
  protocolAnalysis, 
  isProtocolSpecific = false,
  hasHighYieldPools = false,
  searchedProtocol,
  highYieldThreshold = 8
}: DeFiLlamaYieldsTableProps) {
  if (yields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <TrendingUp className="w-12 h-12 text-blue-200/50 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No yield opportunities found</h3>
        <p className="text-sm text-blue-200/80">Try adjusting your search criteria</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
            <h2 className="text-sm md:text-xl font-semibold text-white truncate">
              {isProtocolSpecific 
                ? `${searchedProtocol ? searchedProtocol.charAt(0).toUpperCase() + searchedProtocol.slice(1) : 'Protocol'} Opportunities`
                : hasHighYieldPools 
                  ? 'High-Yield Opportunities' 
                  : 'Yield Opportunities'
              }
            </h2>
          </div>
          <p className="text-xs md:text-sm text-blue-200/80 hidden md:block">
            {isProtocolSpecific 
              ? `Available yield opportunities${hasHighYieldPools ? ` (includes ${yields.filter(y => y.apy >= highYieldThreshold).length} high-yield ≥${highYieldThreshold}%)` : ''}`
              : hasHighYieldPools 
                ? 'Top yield farming and staking opportunities across DeFi protocols'
                : 'Yield farming and staking opportunities across DeFi protocols'
            }
          </p>
        </div>
        
        <Badge variant="secondary" className="h-6 px-2 md:h-8 md:px-4 bg-white/10 text-white border-white/20 text-xs md:text-sm flex-shrink-0">
          <span className="truncate">{yields.length} {yields.length === 1 ? 'opportunity' : 'opportunities'}</span>
        </Badge>
      </div>

      {/* Yields Table */}
      <div className="table-container rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-2 md:p-4">
        <Table className="w-full border-collapse min-w-[320px]">
          <TableHeader>
            <TableRow className="border-b border-white/10">
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80">
                Project
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-right hidden sm:table-cell">
                TVL
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-right">
                APY
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-right">
                Risk
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-center w-12 md:w-16">
                Details
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {yields.map((yieldData, index) => (
              <YieldRow 
                key={`${yieldData.pool}-${yieldData.chain}`} 
                yieldData={yieldData} 
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

      {/* Footer Warning - Only show for high-yield opportunities */}
      {hasHighYieldPools && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-amber-100 mb-1">
                High-Yield Risk Disclosure
              </h4>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                High yields (≥{highYieldThreshold}%) often involve increased risks including impermanent loss, smart contract vulnerabilities, 
                and token emission schedules. Always DYOR and consider your risk tolerance before investing.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* General DeFi warning for protocol-specific searches */}
      {isProtocolSpecific && !hasHighYieldPools && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-blue-100 mb-1">
                DeFi Protocol Information
              </h4>
              <p className="text-xs text-blue-200/80 leading-relaxed">
                These are the available yield opportunities for this protocol. 
                Always verify pool details and understand the underlying mechanisms before investing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
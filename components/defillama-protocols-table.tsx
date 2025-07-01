'use client'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { formatTVL, formatPercentage } from '../lib/defillama/utils'
import { ExternalLink, TrendingUp, Shield, BarChart3, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { DeFiLlamaProtocol } from '../lib/defillama/types'

interface DeFiLlamaProtocolsTableProps {
  protocols: DeFiLlamaProtocol[]
  view: string
  opportunities?: any[]
}

function ProtocolRow({ protocol }: { protocol: DeFiLlamaProtocol }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <>
      <TableRow 
        className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2">
            {protocol.logo && (
              <img 
                src={protocol.logo} 
                alt={protocol.name}
                className="w-4 h-4 md:w-6 md:h-6 rounded-full border border-white/20 flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs md:text-sm font-medium text-white truncate" title={protocol.name}>
                {protocol.name}
              </div>
              <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                <Badge 
                  variant="outline" 
                  className="h-3 md:h-4 px-1 md:px-1.5 text-[10px] md:text-xs border-blue-500/50 text-blue-400 truncate"
                  title={protocol.category}
                >
                  {protocol.category}
                </Badge>
                {protocol.audits && parseInt(protocol.audits) > 0 && (
                  <Badge variant="outline" className="h-3 md:h-4 px-1 md:px-1.5 text-[10px] md:text-xs border-emerald-500/50 text-emerald-400">
                    <Shield className="w-2 h-2 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                    {protocol.audits}
                  </Badge>
                )}
              </div>
              {/* Mobile: Show 24h change below protocol name */}
              <div className="sm:hidden mt-1">
                <span className={`text-xs ${protocol.change_1d && protocol.change_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  24h: {protocol.change_1d ? formatPercentage(protocol.change_1d) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right p-2 md:p-3 text-xs md:text-sm font-semibold">
          <div className="break-words">
            {formatTVL(protocol.tvl)}
          </div>
        </TableCell>
        <TableCell className="text-right p-2 md:p-3 text-xs md:text-sm font-semibold hidden sm:table-cell">
          <span className={protocol.change_1d && protocol.change_1d >= 0 ? 'text-green-400' : 'text-red-400'}>
            {protocol.change_1d ? formatPercentage(protocol.change_1d) : 'N/A'}
          </span>
        </TableCell>
        <TableCell className="text-right p-2 md:p-3 text-xs md:text-sm font-semibold">
          <span className={protocol.change_7d && protocol.change_7d >= 0 ? 'text-green-400' : 'text-red-400'}>
            {protocol.change_7d ? formatPercentage(protocol.change_7d) : 'N/A'}
          </span>
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
            <div className="p-4 bg-black/20 border-t border-white/5">
              {/* Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">1h Change</div>
                  <div className={`font-semibold text-sm ${protocol.change_1h && protocol.change_1h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {protocol.change_1h ? formatPercentage(protocol.change_1h) : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">Market Cap</div>
                  <div className="font-semibold text-sm text-white">
                    {protocol.mcap ? formatTVL(protocol.mcap) : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">Staking</div>
                  <div className="font-semibold text-sm text-white">
                    {protocol.staking ? formatTVL(protocol.staking) : 'N/A'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/5">
                  <div className="text-xs text-blue-200/80 mb-1">Pool2</div>
                  <div className="font-semibold text-sm text-white">
                    {protocol.pool2 ? formatTVL(protocol.pool2) : 'N/A'}
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

              {/* Description */}
              {protocol.description && (
                <div className="mb-4">
                  <div className="text-xs text-blue-200/80 mb-2">About {protocol.name}</div>
                  <p className="text-sm text-white leading-relaxed">
                    {protocol.description}
                  </p>
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

export function DeFiLlamaProtocolsTable({ protocols, view, opportunities }: DeFiLlamaProtocolsTableProps) {
  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <BarChart3 className="w-12 h-12 text-blue-200/50 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No protocols found</h3>
        <p className="text-sm text-blue-200/80">Try adjusting your search criteria</p>
      </div>
    )
  }

  const getViewTitle = () => {
    switch (view) {
      case 'gainers': return 'Top Gainers'
      case 'losers': return 'Top Losers'
      case 'protocols': return 'Top Protocols'
      default: return 'DeFi Protocols'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            <h2 className="text-sm md:text-xl font-semibold text-white truncate">
              {getViewTitle()}
            </h2>
          </div>
          <p className="text-xs md:text-sm text-blue-200/80 hidden md:block">
            Leading DeFi protocols ranked by total value locked (TVL)
          </p>
        </div>
        
        <Badge variant="secondary" className="h-6 px-2 md:h-8 md:px-4 bg-white/10 text-white border-white/20 text-xs md:text-sm flex-shrink-0">
          <span className="truncate">{protocols.length} protocol{protocols.length > 1 ? 's' : ''}</span>
        </Badge>
      </div>

      {/* Protocols Table */}
      <div className="table-container rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-2 md:p-4">
        <Table className="w-full border-collapse min-w-[320px]">
          <TableHeader>
            <TableRow className="border-b border-white/10">
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80">
                Protocol
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-right">
                TVL
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-right hidden sm:table-cell">
                <span className="whitespace-nowrap">24h Change</span>
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-right">
                <span className="whitespace-nowrap">7d Change</span>
              </TableHead>
              <TableHead className="p-2 md:p-3 font-normal text-[10px] md:text-sm text-blue-200/80 text-center w-12 md:w-16">
                Details
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {protocols.map((protocol, index) => (
              <ProtocolRow 
                key={protocol.id} 
                protocol={protocol} 
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
      <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-purple-100 mb-1">
              DeFi Landscape Analysis
            </h4>
            <p className="text-xs text-purple-200/80 leading-relaxed">
              Total Value Locked (TVL) represents the total amount of cryptocurrency assets locked in DeFi protocols. 
              Higher TVL generally indicates greater user trust and protocol adoption. Monitor 24h and 7d changes 
              to identify trending protocols and potential investment opportunities.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
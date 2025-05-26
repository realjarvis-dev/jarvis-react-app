import { SimplifiedPendleMarket } from '@/lib/types/pendle'
import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"

export interface PendleOpportunitiesTableProps {
  opportunities: SimplifiedPendleMarket[]
}

// Format utility functions
function formatUSD(num: number) {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function formatAPY(apy: number) {
  return `${(apy * 100).toFixed(3)}%`
}

function daysUntil(dateStr: string) {
  const now = new Date()
  const expiry = new Date(dateStr)
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export const PendleOpportunitiesTable: React.FC<PendleOpportunitiesTableProps> = ({ opportunities }) => {
  return (
    <div className="overflow-auto table-container">
      <Table className="w-full bg-gray-900 border-separate border-spacing-0 min-w-[640px]">
        <TableHeader>
          <TableRow className="border-b border-gray-800 hover:bg-gray-900">
            <TableHead className="font-semibold text-gray-400">Pool</TableHead>
            <TableHead className="font-semibold text-gray-400">Expiry</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">Liquidity</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">Fixed APY</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((market, index) => {
            const days = daysUntil(market.expiry)
            const expiryDate = new Date(market.expiry).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
            
            return (
              <TableRow 
                key={index} 
                className="border-b border-gray-800 hover:bg-gray-800/80 transition-colors"
              >
                <TableCell className="font-medium py-3 border-r border-r-gray-800/20">
                  <div className="text-xs text-white whitespace-nowrap">
                    {market.name}
                  </div>
                </TableCell>
                <TableCell className="py-3 border-r border-r-gray-800/20">
                  <div className="text-xs text-gray-300 whitespace-nowrap">
                    {expiryDate} <span className="ml-1 text-gray-400">({days} days)</span>
                  </div>
                </TableCell>
                <TableCell className="text-right py-3 text-xs border-r border-r-gray-800/20 whitespace-nowrap">
                  {formatUSD(market.liquidity)}
                </TableCell>
                <TableCell className="text-right py-3 text-xs whitespace-nowrap">
                  <span className={market.impliedApy < 0 ? 'text-red-400' : 'text-green-400'}>
                    {formatAPY(market.impliedApy)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
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
  );
};
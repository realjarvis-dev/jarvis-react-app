import { SimplifiedPendleMarket } from '@/lib/types/pendle'
import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table'

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
  const diff = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )
  return diff
}

export const PendleOpportunitiesTable: React.FC<
  PendleOpportunitiesTableProps
> = ({ opportunities }) => {
  return (
    <div className="table-container rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-4">
      <Table className="w-full border-collapse min-w-[640px]">
        <TableHeader>
          <TableRow className="border-b border-white/10">
            <TableHead className="p-3 font-normal text-sm text-blue-200/80">
              Pool
            </TableHead>
            <TableHead className="p-3 font-normal text-sm text-blue-200/80">
              Expiry
            </TableHead>
            <TableHead className="p-3 font-normal text-sm text-blue-200/80 text-right">
              Liquidity
            </TableHead>
            <TableHead className="p-3 font-normal text-sm text-blue-200/80 text-right">
              Fixed APY
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((market, index) => {
            const days = daysUntil(market.expiry)
            const expiryDate = new Date(market.expiry).toLocaleDateString(
              undefined,
              {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }
            )

            return (
              <TableRow
                key={index}
                className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
              >
                <TableCell className="p-3 font-medium">
                  <div className="text-sm text-white whitespace-nowrap">
                    {market.name} <span className="text-blue-400">PT</span>
                  </div>
                </TableCell>
                <TableCell className="p-3">
                  <div className="text-sm text-gray-300 whitespace-nowrap">
                    {expiryDate}{' '}
                    <span className="ml-1 text-gray-400">({days} days)</span>
                  </div>
                </TableCell>
                <TableCell className="text-right p-3 text-sm font-semibold whitespace-nowrap">
                  {formatUSD(market.liquidity)}
                </TableCell>
                <TableCell className="text-right p-3 text-sm font-semibold whitespace-nowrap">
                  <span
                    className={
                      market.impliedApy < 0 ? 'text-red-400' : 'text-green-400'
                    }
                  >
                    {formatAPY(market.impliedApy)}
                  </span>
                </TableCell>
              </TableRow>
            )
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
  )
}

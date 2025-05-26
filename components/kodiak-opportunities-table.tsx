import React from 'react'
import { FormattedKodiakIsland } from '../lib/types/kodiak'
import { Badge } from './ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"

export interface KodiakOpportunitiesTableProps {
  opportunities: FormattedKodiakIsland[]
}

export const KodiakOpportunitiesTable: React.FC<KodiakOpportunitiesTableProps> = ({ opportunities }) => {
  // Helper to extract price value from price string
  const extractPriceValue = (priceString: string) => {
    const parts = priceString.split('=');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    return priceString;
  };

  // Format TVL values to be more compact (e.g., 300k, 4.5M)
  const formatTVL = (tvlString: string) => {
    // Remove the $ sign and commas
    const numValue = parseFloat(tvlString.replace(/[$,]/g, ''));
    
    if (numValue >= 1_000_000) {
      return `$${(numValue / 1_000_000).toFixed(2)}M`;
    } else if (numValue >= 1_000) {
      return `$${(numValue / 1_000).toFixed(2)}k`;
    } else {
      return tvlString;
    }
  };

  return (
    <div className="w-full overflow-auto">
      <Table className="w-full bg-gray-900">
        <TableHeader>
          <TableRow className="border-b border-gray-800 hover:bg-gray-900">
            <TableHead className="font-semibold text-gray-400">Pool</TableHead>
            <TableHead className="font-semibold text-gray-400">Range</TableHead>
            <TableHead className="font-semibold text-gray-400">Price</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">Pool TVL</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">APR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((island, index) => {
            // Extract token symbols for display
            const token0Symbol = island.token0.symbol;
            
            // Format price strings
            const minPrice = extractPriceValue(island.range.min);
            const maxPrice = extractPriceValue(island.range.max);
            const currentPrice = extractPriceValue(island.price);
            
            return (
              <TableRow 
                key={index} 
                className="border-b border-gray-800 hover:bg-gray-800/80 transition-colors"
              >
                <TableCell className="font-medium py-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-white text-xs">{island.poolName}</span>
                    <Badge className={`${island.management.isManaged ? "bg-blue-600 hover:bg-blue-600" : "bg-amber-700 hover:bg-amber-700"} text-xs py-0.5 px-1.5`}>
                      {island.management.isManaged ? "Managed" : "Unmanaged"}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {island.feeTier}
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <div className="text-xs text-gray-300">
                    <span className="font-bold">Min:</span> {`${token0Symbol} 1 = ${minPrice}`}
                  </div>
                  <div className="text-xs text-gray-300">
                    <span className="font-bold">Max:</span> {`${token0Symbol} 1 = ${maxPrice}`}
                  </div>
                </TableCell>
                <TableCell className="text-amber-500 py-3 text-xs">
                  {`${token0Symbol} 1 = ${currentPrice}`}
                </TableCell>
                <TableCell className="text-right py-3 text-xs">{formatTVL(island.poolTVL)}</TableCell>
                <TableCell className="text-right py-3 text-xs">
                  <div>
                    <span>{island.apr.base}</span>
                    {island.apr.boost && island.apr.boost !== '' && (
                      <>
                        <span>{` + `}</span>
                        <span className="text-green-400">{island.apr.boost.replace('+ ', '')}</span>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}; 
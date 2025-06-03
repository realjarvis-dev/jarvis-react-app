import React from 'react';
import { FormattedKodiakIsland } from '../lib/types/kodiak';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

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
    <div className="overflow-auto table-container">
      <Table className="w-full bg-gray-900 border-separate border-spacing-0 min-w-[800px]">
        <TableHeader>
          <TableRow className="border-b border-gray-800 hover:bg-gray-900">
            <TableHead className="font-semibold text-gray-400">Pool</TableHead>
            <TableHead className="font-semibold text-gray-400">Range</TableHead>
            <TableHead className="font-semibold text-gray-400">Price</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">Pool TVL</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">APR</TableHead>
            <TableHead className="font-semibold text-gray-400 text-center">Managed</TableHead>
            <TableHead className="font-semibold text-gray-400 text-center">Bault</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">Bault APR</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">Bault TVL</TableHead>
            <TableHead className="font-semibold text-gray-400 text-right">Bault Price</TableHead>
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
            
            // Parse APR values
            let baseApr = island.apr.base;
            let boostApr = '';
            if (island.apr.boost && island.apr.boost !== '') {
              boostApr = island.apr.boost.replace('+ ', '');
            }
            
            return (
              <TableRow 
                key={index} 
                className="border-b border-gray-800 hover:bg-gray-800/80 transition-colors"
              >
                <TableCell className="font-medium py-3 border-r border-r-gray-800/20">
                  <div className="text-xs text-white whitespace-nowrap">
                    {island.poolName}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 whitespace-nowrap">
                    {island.feeTier}
                  </div>
                </TableCell>
                <TableCell className="py-3 border-r border-r-gray-800/20">
                  <div className="text-xs text-gray-300 whitespace-nowrap">
                    <span className="font-bold">Min:</span> {`${token0Symbol} 1 = ${minPrice}`}
                  </div>
                  <div className="text-xs text-gray-300 whitespace-nowrap">
                    <span className="font-bold">Max:</span> {`${token0Symbol} 1 = ${maxPrice}`}
                  </div>
                </TableCell>
                <TableCell className="text-amber-500 py-3 text-xs border-r border-r-gray-800/20 whitespace-nowrap">
                  {`${token0Symbol} 1 = ${currentPrice}`}
                </TableCell>
                <TableCell className="text-right py-3 text-xs border-r border-r-gray-800/20 whitespace-nowrap">
                  {formatTVL(island.poolTVL)}
                </TableCell>
                <TableCell className="text-right py-3 text-xs border-r border-r-gray-800/20">
                  <div className="whitespace-nowrap">{baseApr}</div>
                  {boostApr && (
                    <div className="whitespace-nowrap text-green-400">+ {boostApr}</div>
                  )}
                </TableCell>
                <TableCell className="text-center py-3 text-xs border-r border-r-gray-800/20 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${island.management.isManaged ? "bg-blue-600/20 text-blue-400" : "bg-amber-700/20 text-amber-400"}`}>
                    {island.management.isManaged ? "Yes" : "No"}
                  </span>
                </TableCell>
                <TableCell className="text-center py-3 text-xs border-r border-r-gray-800/20 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${island.bault.hasBault ? "bg-green-600/20 text-green-400" : "bg-gray-700/20 text-gray-400"}`}>
                    {island.bault.hasBault ? "Yes" : "No"}
                  </span>
                </TableCell>
                <TableCell className="text-right py-3 text-xs border-r border-r-gray-800/20 whitespace-nowrap">
                  {island.bault.hasBault ? island.bault.apr : "-"}
                </TableCell>
                <TableCell className="text-right py-3 text-xs border-r border-r-gray-800/20 whitespace-nowrap">
                  {island.bault.hasBault ? formatTVL(island.bault.tvl) : "-"}
                </TableCell>
                <TableCell className="text-right py-3 text-xs whitespace-nowrap">
                  {island.bault.hasBault ? island.bault.price : "-"}
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
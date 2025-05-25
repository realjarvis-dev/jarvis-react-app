import { Badge } from '@/components/ui/badge'
import React from 'react'
import { FormattedKodiakIsland } from '../lib/types/kodiak'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

export interface KodiakOpportunityCardProps extends FormattedKodiakIsland {
  // All fields are inherited from FormattedKodiakIsland
}

export const KodiakOpportunityCard: React.FC<KodiakOpportunityCardProps> = (island) => {
  // Extract token symbols for display
  const token0Symbol = island.token0.symbol;
  const token1Symbol = island.token1.symbol;
  
  // Clean token symbols display
  const extractPriceValue = (priceString: string) => {
    const parts = priceString.split('=');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    return priceString;
  };
  
  // Format price strings
  const minPrice = extractPriceValue(island.range.min);
  const maxPrice = extractPriceValue(island.range.max);
  const currentPrice = extractPriceValue(island.price);
  
  return (
    <Card className="w-full bg-gray-900 hover:bg-gray-900/90 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">{island.poolName}</CardTitle>
          <Badge className={`${island.management.isManaged ? "bg-blue-600 hover:bg-blue-600" : "bg-amber-700 hover:bg-amber-700"} text-xs py-1 px-2`}>
            {island.management.isManaged ? "Managed" : "Unmanaged"}
          </Badge>
        </div>
        <CardDescription className="text-sm mt-1">
          Swap fee: {island.feeTier}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {/* APR */}
        <div className="flex justify-between items-center">
          <h3 className="text-base font-medium text-muted-foreground">APR</h3>
          <span className="text-lg font-bold text-green-400">
            {island.apr.base.replace('%', '')}
            {island.apr.boost && island.apr.boost !== '' ? 
              ` ${island.apr.boost}` : 
              '%'}
          </span>
        </div>
        
        {/* TVL */}
        <div className="flex justify-between items-center">
          <h3 className="text-base font-medium text-muted-foreground">TVL</h3>
          <span className="text-lg font-bold">{island.poolTVL}</span>
        </div>
        
        {/* Price Range */}
        <div className="space-y-1">
          <h3 className="text-base font-medium text-muted-foreground">Price Range</h3>
          <div className="space-y-0.5 text-sm">
            <div>
              Min: {`${token0Symbol} 1 = ${minPrice}`}
            </div>
            <div>
              Max: {`${token0Symbol} 1 = ${maxPrice}`}
            </div>
          </div>
        </div>
        
        {/* Current Price */}
        <div className="space-y-1">
          <h3 className="text-base font-medium text-muted-foreground">Current{island.management.isManaged ? " Price" : ""}</h3>
          <div className="text-base font-semibold text-amber-500">
            {`${token0Symbol} 1 = ${currentPrice}`}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
import { tool } from 'ai'
import { z } from 'zod'
import { getKodiakOpportunitiesFromApi } from '../kodiak/api'
import { tickToPrice } from '../kodiak/utils'
import { FormattedKodiakIsland } from '../types/kodiak'

/**
 * Formats a price value with proper handling of extremely large numbers
 * @param price The price to format
 * @returns Formatted price string
 */
function formatPrice(price: number, tokenSymbol: string): string {
  // Handle extremely large numbers
  if (price > 1_000_000) {
    return `∞ ${tokenSymbol}`;
  } else if (price < 0.000001 && price > 0) {
    return `≈0 ${tokenSymbol}`;
  }
  return `${price.toFixed(5)} ${tokenSymbol}`;
}

export const kodiakOpportunitiesTool = tool({
  description: 'Get Kodiak Island yield opportunities on Berachain. This tool automatically renders UI.',
  parameters: z.object({
    apr_gte: z
      .number()
      .optional()
      .describe(
        'Minimum APR in percentage (e.g., 7 for 7%). Filters for APR >= value. Optional.'
      ),
    apr_lte: z
      .number()
      .optional()
      .describe(
        'Maximum APR in percentage (e.g., 10 for 10%). Filters for APR <= value. Optional.'
      ),
    sort_by: z
      .enum(['apr', 'tvl'])
      .default('apr')
      .describe('Field to sort by: "apr" or "tvl" (default: "tvl")'),
    max_results: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe('Number of opportunities to return (default 10)')
  }),
  execute: async ({ 
    apr_gte, 
    apr_lte, 
    sort_by = 'tvl', 
    max_results = 10 
  }) => {
    try {
      // Fetch all active islands with reasonable TVL using the new API endpoint
      const islands = await getKodiakOpportunitiesFromApi({
        minTvl: 10, // Lower threshold to show more islands
        includeInactive: false
      });
      
      // Filter out islands with null tick data (Uniswap V2 pools)
      let filteredIslands = islands.filter(island => 
        island.lowerTick !== null && 
        island.upperTick !== null && 
        island.tick !== null
      );
      
      // Apply APR filters if provided
      if (apr_gte !== undefined) {
        const minApr = apr_gte / 100; // Convert percentage to decimal
        filteredIslands = filteredIslands.filter(island => 
          island.apr.combinedApr >= minApr
        );
      }
      
      // Filter by maximum APR if specified
      if (apr_lte !== undefined) {
        const maxApr = apr_lte / 100; // Convert percentage to decimal
        filteredIslands = filteredIslands.filter(island => 
          island.apr.combinedApr <= maxApr
        );
      }
      
      // Sort islands by specified field
      if (sort_by === 'apr') {
        filteredIslands.sort((a, b) => b.apr.combinedApr - a.apr.combinedApr);
      } else {
        // Default: sort by TVL
        filteredIslands.sort((a, b) => b.tvl.usdValue - a.tvl.usdValue);
      }
      
      // Format islands for display
      const formattedIslands: FormattedKodiakIsland[] = filteredIslands.slice(0, max_results).map(island => {
        // Regular Kodiak Islands with tick-based pricing
        const lowerPrice = tickToPrice(island.lowerTick);
        const upperPrice = tickToPrice(island.upperTick);
        
        // Format price range
        const minPriceText = lowerPrice > 1_000_000 
          ? `${island.token0.symbol} 1 = ∞ ${island.token1.symbol}`
          : (lowerPrice < 0.000001 && lowerPrice > 0
              ? `${island.token0.symbol} 1 = ≈0 ${island.token1.symbol}`
              : `${island.token0.symbol} 1 = ${lowerPrice.toFixed(4)} ${island.token1.symbol}`);
        
        const maxPriceText = upperPrice > 1_000_000 
          ? `${island.token0.symbol} 1 = ∞ ${island.token1.symbol}`
          : (upperPrice < 0.000001 && upperPrice > 0
              ? `${island.token0.symbol} 1 = ≈0 ${island.token1.symbol}`
              : `${island.token0.symbol} 1 = ${upperPrice.toFixed(4)} ${island.token1.symbol}`);
        
        // Format current price
        let currentPriceText = '';
        if (island.currentPrice && island.currentPrice > 0) {
          currentPriceText = `${island.token0.symbol} 1 = ${formatPrice(island.currentPrice, island.token1.symbol)}`;
        } else if (island.tick) {
          // If we have tick but not price, calculate it
          const calculatedPrice = Math.pow(1.0001, island.tick);
          currentPriceText = `${island.token0.symbol} 1 = ${formatPrice(calculatedPrice, island.token1.symbol)}`;
        } else {
          // Fallback if we can't calculate price
          currentPriceText = `${island.token0.symbol} 1 = (price unavailable)`;
        }
        
        // Format fee tier (convert from basis points to percentage)
        const feeTier = island.feeTier !== null 
          ? (island.feeTier / 10000).toFixed(2) + '%'
          : '0.00%';
        
        // Format APR components - now use the explicit rewardApr field from the API
        const baseAPR = island.apr.feeApr;
        const boostAPR = island.apr.rewardApr || (island.apr.combinedApr - island.apr.feeApr);
        
        const formattedBaseAPR = (baseAPR * 100).toFixed(2) + '%';
        const formattedBoostAPR = boostAPR > 0 ? '+ ' + (boostAPR * 100).toFixed(2) + '%' : '';
        
        // Format TVL in USD
        const poolTVL = '$' + Number(island.tvl.usdValue).toLocaleString();
        
        return {
          poolName: `${island.token0.symbol} - ${island.token1.symbol}`,
          feeTier,
          poolType: island.poolType || 'Island',
          range: {
            min: minPriceText,
            max: maxPriceText,
          },
          price: currentPriceText,
          poolTVL,
          farmTVL: poolTVL, // Same as pool TVL for Kodiak
          apr: {
            base: formattedBaseAPR,
            boost: formattedBoostAPR
          },
          holdings: '$0', // Default to zero for user
          address: island.address,
          token0: island.token0,
          token1: island.token1,
          management: {
            isManaged: island.isManaged,
            managerAddress: island.manager
          }
        };
      });
      
      // Return minimal data for streaming, but include full data for UI
      return {
        _uiDisplayTool: true,
        summary: `Found ${formattedIslands.length} Kodiak Island opportunities`,
        count: formattedIslands.length,
        data: formattedIslands
      };
    } catch (error) {
      console.error('Error in Kodiak opportunities tool:', error);
      return {
        _uiDisplayTool: true,
        summary: 'Error fetching Kodiak opportunities',
        count: 0,
        data: []
      };
    }
  }
}) 
import { tool } from 'ai'
import { z } from 'zod'
import { getKodiakOpportunities } from '../kodiak/api'
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

/**
 * Formats manager fee from basis points to percentage
 * @param feeBPS Manager fee in basis points (1 BPS = 0.01%)
 * @returns Formatted manager fee as percentage
 */
function formatManagerFee(feeBPS: number): string {
  return (feeBPS / 100).toFixed(2) + '%';
}

export const kodiakOpportunitiesTool = tool({
  description: 'Get Kodiak Island yield opportunities on Berachain.',
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
      .default('tvl')
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
      // Fetch all active islands with reasonable TVL
      const islands = await getKodiakOpportunities({
        minTvl: 10, // Lower threshold to show more islands
        includeInactive: false
      });
      
      // Apply APR filters if provided
      let filteredIslands = [...islands];
      
      // Filter by minimum APR if specified
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
        // Calculate price range
        const lowerPrice = tickToPrice(island.lowerTick);
        const upperPrice = tickToPrice(island.upperTick);
        
        // Format current price
        let currentPrice = '';
        if (island.currentPrice) {
          currentPrice = formatPrice(island.currentPrice, island.token1.symbol);
        } else if (island.tick) {
          // If we have tick but not price, calculate it
          const calculatedPrice = Math.pow(1.0001, island.tick);
          currentPrice = formatPrice(calculatedPrice, island.token1.symbol);
        }
        
        // Format fee tier (convert from basis points to percentage)
        const feeTier = (island.feeTier / 10000).toFixed(2) + '%';
        
        // Format APR components
        const baseAPR = island.apr.feeApr;
        let boostAPR = 0;
        
        // Some pools might have additional yield sources
        if (island.apr.combinedApr > island.apr.feeApr) {
          boostAPR = island.apr.combinedApr - island.apr.feeApr;
        }
        
        const formattedBaseAPR = (baseAPR * 100).toFixed(2) + '%';
        const formattedBoostAPR = boostAPR > 0 ? '+ ' + (boostAPR * 100).toFixed(2) + '%' : '';
        
        // Format TVL in USD
        const poolTVL = '$' + Number(island.tvl.usdValue).toLocaleString();
        
        return {
          poolName: `${island.token0.symbol} - ${island.token1.symbol}`,
          feeTier,
          poolType: island.poolType || 'Island',
          range: {
            min: lowerPrice > 1_000_000 
              ? `1 ${island.token0.symbol} = ∞ ${island.token1.symbol}`
              : (lowerPrice < 0.000001 && lowerPrice > 0
                  ? `1 ${island.token0.symbol} = ≈0 ${island.token1.symbol}`
                  : `1 ${island.token0.symbol} = ${lowerPrice.toFixed(4)} ${island.token1.symbol}`),
            max: upperPrice > 1_000_000 
              ? `1 ${island.token0.symbol} = ∞ ${island.token1.symbol}`
              : (upperPrice < 0.000001 && upperPrice > 0
                  ? `1 ${island.token0.symbol} = ≈0 ${island.token1.symbol}`
                  : `1 ${island.token0.symbol} = ${upperPrice.toFixed(4)} ${island.token1.symbol}`),
          },
          price: `1 ${island.token0.symbol} = ${currentPrice}`,
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
            managerAddress: island.manager,
            managerFee: formatManagerFee(island.managerFeeBPS)
          }
        };
      });
      
      return formattedIslands;
    } catch (error) {
      console.error('Error in Kodiak opportunities tool:', error);
      return [];
    }
  }
}) 
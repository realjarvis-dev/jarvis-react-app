import { tool } from 'ai';
import { ethers } from 'ethers';
import { Address } from 'viem';
import { z } from 'zod';
import { BerachainMainnetConfig } from "../config/network";
import { BAULT_ABI, IBGT_ADDRESS } from '../kodiak/abi';
import { getIslandDetails, getKodiakOpportunitiesFromApi } from '../kodiak/api';
import { depositToKodiakIsland, IslandSingleDepositParams } from '../kodiak/islandRatio';
import { checkBault, checkProfitability, compoundBaultWithHelper } from '../kodiak/kodiak-baults';
import { tickToPrice } from '../kodiak/utils';
import { getUserWallet } from '../privy/client';
import { FormattedKodiakIsland } from '../types/kodiak';
import { NetworkContext } from '../utils/tool-registry';

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

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
 * Formats a big number amount to a human-readable format
 * @param amount The amount as a bigint or string
 * @param decimals The number of decimals (default: 18)
 * @returns Formatted amount string with up to 6 decimal places
 */
function formatAmount(amount: string | bigint, decimals: number = 18): string {
  try {
    // Convert to string if it's a bigint
    const amountStr = amount.toString();
    
    // Use ethers to format with proper decimals
    const formatted = ethers.formatUnits(amountStr, decimals);
    
    // Parse to float and format with up to 6 decimal places for display
    const value = parseFloat(formatted);
    
    // For very small values, show scientific notation
    if (value < 0.000001 && value > 0) {
      return value.toExponential(4);
    }
    
    // For large values, limit decimal places
    if (value > 1000) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
    
    // For medium values
    if (value > 1) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      });
    }
    
    // For smaller values, show more decimals
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    });
  } catch (error) {
    console.error("Error formatting amount:", error);
    return amount.toString();
  }
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
    bault_apr_gte: z
      .number()
      .optional()
      .describe(
        'Minimum Bault APR in percentage (e.g., 50 for 50%). Filters islands with baults having APR >= value. Optional.'
      ),
    bault_apr_lte: z
      .number()
      .optional()
      .describe(
        'Maximum Bault APR in percentage (e.g., 100 for 100%). Filters islands with baults having APR <= value. Optional.'
      ),
    bault_tvl_gte: z
      .number()
      .optional()
      .describe(
        'Minimum Bault TVL in USD (e.g., 10000 for $10,000). Filters islands with baults having TVL >= value. Optional.'
      ),
    bault_tvl_lte: z
      .number()
      .optional()
      .describe(
        'Maximum Bault TVL in USD (e.g., 100000 for $100,000). Filters islands with baults having TVL <= value. Optional.'
      ),
    sort_by: z
      .enum(['apr', 'tvl', 'bault_apr'])
      .default('apr')
      .describe('Field to sort by: "apr", "tvl", or "bault_apr" (default: "tvl")'),
    max_results: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe('Number of opportunities to return (default 10)'),
    bault_filter: z
      .enum(['only', 'exclude', 'include'])
      .optional()
      .describe('Filter islands by bault status: "only" (only show islands with baults), "exclude" (hide islands with baults), or "include" (show all islands, default). Note: If any bault_apr_* or bault_tvl_* filters are used, this is automatically set to "only".')
  }),
  execute: async (params, context: ToolContext) => {
    const { 
      apr_gte, 
      apr_lte, 
      bault_apr_gte,
      bault_apr_lte,
      bault_tvl_gte,
      bault_tvl_lte,
      sort_by = 'tvl', 
      max_results = 10,
      bault_filter: userBaultFilter
    } = params;
    
    // If any bault-specific filters are set, automatically filter for baults only
    // unless the user explicitly specified a different filter
    let bault_filter = userBaultFilter;
    if (!userBaultFilter && (bault_apr_gte !== undefined || bault_apr_lte !== undefined || 
        bault_tvl_gte !== undefined || bault_tvl_lte !== undefined)) {
      bault_filter = 'only';
      console.log('Automatically filtering for islands with baults due to bault-specific filters');
    }
    
    const networkContext = context?.networkContext;

    try {      
      // Fetch all active islands with reasonable TVL using the new API endpoint
      const islands = await getKodiakOpportunitiesFromApi({
        minTvl: 10, // Lower threshold to show more islands
        includeInactive: false,
        filterBaults: bault_filter // Pass the bault filter to the API function
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
      
      // Filter by bault status if not already filtered at API level
      if (bault_filter) {
        if (bault_filter === 'only') {
          // Only show islands with baults
          filteredIslands = filteredIslands.filter(island => 
            island.baults && island.baults.length > 0
          );
          console.log(`Filtered to ${filteredIslands.length} islands with baults`);
        } else if (bault_filter === 'exclude') {
          // Exclude islands with baults
          filteredIslands = filteredIslands.filter(island => 
            !island.baults || island.baults.length === 0
          );
          console.log(`Filtered to ${filteredIslands.length} islands without baults`);
        }
      }
      
      // Apply Bault APR filters if provided
      if (bault_apr_gte !== undefined) {
        filteredIslands = filteredIslands.filter(island => {
          // Keep only islands with baults and APR above threshold
          if (!island.baults || island.baults.length === 0) {
            return false; // Filter out islands without baults
          }
          return island.baults[0].apy >= bault_apr_gte;
        });
        console.log(`Filtered to ${filteredIslands.length} islands with bault APR >= ${bault_apr_gte}%`);
      }
      
      if (bault_apr_lte !== undefined) {
        filteredIslands = filteredIslands.filter(island => {
          // Keep only islands with baults and APR below threshold
          if (!island.baults || island.baults.length === 0) {
            return false; // Filter out islands without baults
          }
          return island.baults[0].apy <= bault_apr_lte;
        });
        console.log(`Filtered to ${filteredIslands.length} islands with bault APR <= ${bault_apr_lte}%`);
      }
      
      // Apply Bault TVL filters if provided
      if (bault_tvl_gte !== undefined) {
        filteredIslands = filteredIslands.filter(island => {
          // Keep only islands with baults and TVL above threshold
          if (!island.baults || island.baults.length === 0) {
            return false; // Filter out islands without baults
          }
          const baultTVL = island.baults[0].totalAssets * island.baults[0].price;
          return baultTVL >= bault_tvl_gte;
        });
        console.log(`Filtered to ${filteredIslands.length} islands with bault TVL >= $${bault_tvl_gte.toLocaleString()}`);
      }
      
      if (bault_tvl_lte !== undefined) {
        filteredIslands = filteredIslands.filter(island => {
          // Keep only islands with baults and TVL below threshold
          if (!island.baults || island.baults.length === 0) {
            return false; // Filter out islands without baults
          }
          const baultTVL = island.baults[0].totalAssets * island.baults[0].price;
          return baultTVL <= bault_tvl_lte;
        });
        console.log(`Filtered to ${filteredIslands.length} islands with bault TVL <= $${bault_tvl_lte.toLocaleString()}`);
      }
      
      // Sort islands by specified field
      if (sort_by === 'apr') {
        filteredIslands.sort((a, b) => b.apr.combinedApr - a.apr.combinedApr);
      } else if (sort_by === 'bault_apr') {
        // Sort by bault APY - put islands with baults at the top
        filteredIslands.sort((a, b) => {
          // If neither has a bault, maintain current order
          if ((!a.baults || a.baults.length === 0) && (!b.baults || b.baults.length === 0)) {
            return 0;
          }
          // If only a has a bault, put a first
          if (a.baults && a.baults.length > 0 && (!b.baults || b.baults.length === 0)) {
            return -1;
          }
          // If only b has a bault, put b first
          if ((!a.baults || a.baults.length === 0) && b.baults && b.baults.length > 0) {
            return 1;
          }
          // Both have baults, compare their APYs
          return b.baults![0].apy - a.baults![0].apy;
        });
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
        
        // Process bault information if available
        const hasBault = !!(island.baults && island.baults.length > 0);
        let baultApr = '';
        let baultTvl = '';
        let baultPrice = '';
        let baultId = '';
        
        if (hasBault && island.baults && island.baults.length > 0) {
          const bault = island.baults[0]; // Get the first bault
          baultApr = (bault.apy).toFixed(2) + '%';
          baultTvl = '$' + (bault.totalAssets * bault.price).toLocaleString();
          baultPrice = bault.price.toFixed(4);
          baultId = bault.id;
        }
        
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
          },
          bault: {
            hasBault,
            apr: baultApr,
            tvl: baultTvl,
            price: baultPrice,
            id: baultId
          }
        };
      });
      
      // Build a summary that includes active filters
      let filterDescription = '';
      
      // Add bault filter description
      if (bault_filter === 'only') {
        filterDescription += ' with baults';
      } else if (bault_filter === 'exclude') {
        filterDescription += ' without baults';
      }
      
      // Add bault APR filter description
      if (bault_apr_gte !== undefined && bault_apr_lte !== undefined) {
        filterDescription += ` and bault APR between ${bault_apr_gte}%-${bault_apr_lte}%`;
      } else if (bault_apr_gte !== undefined) {
        filterDescription += ` and bault APR ≥ ${bault_apr_gte}%`;
      } else if (bault_apr_lte !== undefined) {
        filterDescription += ` and bault APR ≤ ${bault_apr_lte}%`;
      }
      
      // Add bault TVL filter description
      if (bault_tvl_gte !== undefined || bault_tvl_lte !== undefined) {
        filterDescription += ' and bault TVL';
        if (bault_tvl_gte !== undefined && bault_tvl_lte !== undefined) {
          filterDescription += ` between $${bault_tvl_gte.toLocaleString()}-$${bault_tvl_lte.toLocaleString()}`;
        } else if (bault_tvl_gte !== undefined) {
          filterDescription += ` ≥ $${bault_tvl_gte.toLocaleString()}`;
        } else if (bault_tvl_lte !== undefined) {
          filterDescription += ` ≤ $${bault_tvl_lte.toLocaleString()}`;
        }
      }
      
      // Return minimal data for streaming, but include full data for UI
      return {
        _uiDisplayTool: true,
        summary: `Found ${formattedIslands.length} Kodiak Island opportunities${filterDescription}`,
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

export const kodiakDepositTool = tool({
  description: 'Deposit a single token into a Kodiak Island yield opportunity on Berachain. This tool automatically renders UI.',
  parameters: z.object({
    island_address: z
      .string()
      .describe('The address of the Kodiak Island to deposit into'),
    amount: z
      .string()
      .describe('Amount of token to deposit in human-readable format (e.g., "1", "0.5")'),
    is_token0: z
      .boolean()
      .default(true)
      .describe('Whether to deposit token0 (true) or token1 (false). Default is true for token0.'),
    slippage_bps: z
      .number()
      .min(1)
      .max(1000)
      .default(50)
      .describe('Slippage tolerance in basis points (e.g., 50 for 0.5%). Default is 50 BPS.'),
    min_shares_received: z
      .string()
      .default('0.01')
      .describe('Minimum shares expected to receive from the deposit (default: 0.01)')
  }),
  execute: async (params, context: ToolContext) => {
    const { 
      island_address, 
      amount, 
      is_token0 = true, 
      slippage_bps = 50, 
      min_shares_received = '0.01'
    } = params;
    
    const networkContext = context?.networkContext;

    try {
      // Prepare deposit parameters
      const depositParams: IslandSingleDepositParams = {
        islandAddress: island_address,
        totalAmount: amount,
        isToken0: is_token0,
        slippageBPS: slippage_bps,
        minSharesReceived: min_shares_received
      };

      // Execute the deposit
      const result = await depositToKodiakIsland(depositParams);

      if (result.status === 'success') {
        const depositData = {
          success: true,
          transaction_hash: result.hash,
          deposit_details: {
            island_address,
            amount_deposited: `${amount} ${is_token0 ? 'Token0' : 'Token1'}`,
            slippage_bps,
            min_shares_received,
            complete_time: new Date().toISOString()
          }
        };

        console.log('[Kodiak Deposit Tool] Returning success data:', depositData);

        return {
          _uiDisplayTool: true,
          summary: `Deposit successful: ${amount} ${is_token0 ? 'Token0' : 'Token1'} deposited to Kodiak Island`,
          data: depositData
        };
      } else {
        const errorData = {
          success: false,
          error: result.error_message || 'Deposit failed',
          deposit_parameters: {
            island_address,
            amount,
            is_token0,
            slippage_bps,
            min_shares_received
          }
        };

        console.log('[Kodiak Deposit Tool] Returning error data:', errorData);

        return {
          _uiDisplayTool: true,
          summary: `Deposit failed: ${result.error_message || 'Unknown error'}`,
          data: errorData
        };
      }
    } catch (error) {
      console.error('Error in Kodiak deposit tool:', error);
      
      const errorData = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute Kodiak deposit',
        deposit_parameters: {
          island_address,
          amount,
          is_token0,
          slippage_bps,
          min_shares_received
        }
      };

      console.log('[Kodiak Deposit Tool] Returning catch error data:', errorData);

      return {
        _uiDisplayTool: true,
        summary: `Deposit failed: ${error instanceof Error ? error.message : 'Failed to execute Kodiak deposit'}`,
        data: errorData
      };
    }
  }
})

export const kodiakBaultProfitabilityTool = tool({
  description: 'Check the profitability of Kodiak Baults for compounding. Returns detailed information about each bault\'s potential profit.',
  parameters: z.object({
    bault_addresses: z
      .array(z.string())
      .describe('Array of Bault contract addresses to check'),
    wrapper_address: z
      .string()
      .optional()
      .describe('BGT wrapper token address to use for profitability calculation (defaults to iBGT)'),
    slippage_bps: z
      .number()
      .min(1)
      .max(1000)
      .default(100)
      .describe('Slippage tolerance in basis points (e.g., 100 for 1%). Default is 100 BPS.'),
    min_profit_percentage: z
      .number()
      .optional()
      .describe('Minimum profit percentage threshold (e.g., 5 for 5%) for a bault to be considered profitable')
  }),
  execute: async (params, context: ToolContext) => {
    const { 
      bault_addresses,
      wrapper_address = IBGT_ADDRESS, 
      slippage_bps = 100,
      min_profit_percentage
    } = params;
    
    try {
      // Define proper types for our results
      type ProfitableBaultResult = {
        bault_address: string;
        staking_token: string;
        staking_pool_name?: string; // Add pool name
        is_ready: boolean;
        is_profitable: boolean;
        bounty: string;
        formattedBounty: string;
        wrapper_amount: string;
        formattedWrapperAmount: string;
        estimated_output: string;
        formattedEstimatedOutput: string;
        profit: string;
        formattedProfit: string;
        profit_percentage: string;
      };
      
      type ErrorBaultResult = {
        bault_address: string;
        is_profitable: false;
        error: string;
        error_type?: string;
      };
      
      type BaultResult = ProfitableBaultResult | ErrorBaultResult;
      
      const results: BaultResult[] = [];
      const profitableBaults: ProfitableBaultResult[] = [];
      let swapErrorCount = 0;
      
      // Check each bault
      for (const baultAddress of bault_addresses) {
        try {
          // First get the bault data
          const baultData = await checkBault(baultAddress, wrapper_address as Address);
          
          if (!baultData) {
            results.push({
              bault_address: baultAddress,
              is_profitable: false,
              error: "Failed to fetch bault data"
            });
            continue;
          }
          
          // Get staking token from the bault
          const bault = new ethers.Contract(
            baultAddress,
            BAULT_ABI,
            new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl)
          );
          
          const stakingToken = await bault.stakingToken();
          
          // Try to get island details for the staking token (which is likely a Kodiak Island LP token)
          let poolName = "";
          try {
            const islandDetails = await getIslandDetails(stakingToken);
            if (islandDetails) {
              poolName = `${islandDetails.token0.symbol}-${islandDetails.token1.symbol}`;
            }
          } catch (error) {
            console.error(`Error fetching pool name for ${stakingToken}:`, error);
            // Continue with empty pool name if we can't fetch it
          }
          
          // Check profitability
          const profitability = await checkProfitability(
            baultAddress,
            stakingToken as Address,
            wrapper_address as Address
          );
          
          // If we got an error related to swap estimation, increment the counter
          if (profitability.error && profitability.errorType === 'swap_estimation') {
            swapErrorCount++;
          }
          
          // Calculate profit percentage relative to bounty
          const profitPercentage = profitability.bounty > 0 
            ? Number((profitability.profit * BigInt(10000) / profitability.bounty)) / 100
            : 0;
          
          // Check if it meets minimum profit threshold if specified
          const meetsMinProfitThreshold = min_profit_percentage === undefined || 
            (profitability.isReady && profitPercentage >= min_profit_percentage);
          
          if (profitability.error) {
            // Handle error case
            results.push({
              bault_address: baultAddress,
              is_profitable: false,
              error: profitability.error,
              error_type: profitability.errorType
            });
          } else {
            // Format all the bigint values to be human-readable
            const formattedBounty = formatAmount(profitability.bounty);
            const formattedWrapperAmount = formatAmount(profitability.wrapperAmount);
            const formattedEstimatedOutput = formatAmount(profitability.estimatedOutput);
            const formattedProfit = formatAmount(profitability.profit);
            
            // Handle success case
            const baultResult: ProfitableBaultResult = {
              bault_address: baultAddress,
              staking_token: stakingToken,
              staking_pool_name: poolName || undefined,
              is_ready: profitability.isReady,
              is_profitable: profitability.isReady && meetsMinProfitThreshold,
              bounty: profitability.bounty.toString(),
              formattedBounty,
              wrapper_amount: profitability.wrapperAmount.toString(),
              formattedWrapperAmount,
              estimated_output: profitability.estimatedOutput.toString(),
              formattedEstimatedOutput,
              profit: profitability.profit.toString(),
              formattedProfit,
              profit_percentage: `${profitPercentage.toFixed(2)}%`
            };
            
            results.push(baultResult);
            
            if (baultResult.is_profitable) {
              profitableBaults.push(baultResult);
            }
          }
        } catch (error) {
          results.push({
            bault_address: baultAddress,
            is_profitable: false,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
      
      // Sort results by profit (descending)
      results.sort((a, b) => {
        // If either result is an error result, treat its profit as 0
        const profitA = 'profit' in a ? BigInt(a.profit) : BigInt(0);
        const profitB = 'profit' in b ? BigInt(b.profit) : BigInt(0);
        
        // Sort by profit in descending order (using number comparison for sort)
        return profitA > profitB ? -1 : profitA < profitB ? 1 : 0;
      });
      
      // Find the most profitable bault
      const mostProfitable = profitableBaults.length > 0 
        ? [...profitableBaults].sort((a, b) => {
            const profitA = BigInt(a.profit);
            const profitB = BigInt(b.profit);
            // Return -1, 0, or 1 for sort function (as numbers)
            return profitA > profitB ? -1 : profitA < profitB ? 1 : 0;
          })[0]
        : null;
      
      // Create summary message with additional context if there were swap errors
      let summaryMessage = `Found ${profitableBaults.length} profitable baults out of ${bault_addresses.length} checked.`;
      
      if (swapErrorCount > 0) {
        summaryMessage += ` Note: ${swapErrorCount} baults had swap estimation errors.`;
      }
      
      const profitableSummary = mostProfitable 
        ? `Most profitable: ${mostProfitable.staking_pool_name || mostProfitable.bault_address} with ${mostProfitable.profit_percentage} profit`
        : 'No profitable baults found';
      
      // Return data with UI rendering information
      return {
        _uiDisplayTool: true,
        _uiComponent: 'KodiakBaultProfitability', // Custom UI component to render
        summary: `${summaryMessage} ${profitableSummary}`,
        count: {
          total: bault_addresses.length,
          profitable: profitableBaults.length,
          error_count: swapErrorCount
        },
        most_profitable: mostProfitable,
        data: results
      };
    } catch (error) {
      console.error('Error in Kodiak Bault profitability tool:', error);
      
      return {
        _uiDisplayTool: true,
        _uiComponent: 'KodiakBaultProfitability', // Still use the UI component for error display
        summary: 'Error checking Kodiak Bault profitability',
        count: {
          total: bault_addresses.length,
          profitable: 0
        },
        data: [],
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
})

export const kodiakCompoundBaultTool = tool({
  description: 'Compound a profitable Kodiak Bault using the BountyHelper contract (zero-capital compounding). This executes a transaction to claim BGT rewards.',
  parameters: z.object({
    bault_address: z
      .string()
      .describe('The address of the Bault to compound'),
    wrapper_address: z
      .string()
      .default(IBGT_ADDRESS)
      .describe('BGT wrapper token address to use for claiming rewards (defaults to iBGT)'),
    profit_receiver_address: z
      .string()
      .optional()
      .describe('Address to receive the profit (defaults to user wallet address)')
  }),
  execute: async (params, context: ToolContext) => {
    const { 
      bault_address,
      wrapper_address = IBGT_ADDRESS, 
      profit_receiver_address
    } = params;
    
    try {
      // Get user wallet
      const wallet = await getUserWallet('ethereum');
      if (!wallet || !wallet.address) {
        throw new Error('User wallet not found');
      }
      
      // Use user's address as profit receiver if not specified
      const profitReceiver = profit_receiver_address || wallet.address;
      
      // First check profitability
      const stakingToken = await new ethers.Contract(
        bault_address,
        BAULT_ABI,
        new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl)
      ).stakingToken();
      
      const profitability = await checkProfitability(
        bault_address,
        stakingToken as Address,
        wrapper_address as Address
      );
      
      // Proceed only if profitable
      if (!profitability.isReady) {
        return {
          _uiDisplayTool: true,
          summary: `Cannot compound Bault: not ready for compounding. The profit does not exceed the bounty.`,
          status: 'fail',
          error_message: 'Bault is not profitable to compound. The value of iBGT rewards does not exceed the bounty cost.',
          profitability: {
            isReady: profitability.isReady,
            profit: formatAmount(profitability.profit),
            bounty: formatAmount(profitability.bounty),
            wrapperAmount: formatAmount(profitability.wrapperAmount),
            estimatedOutput: formatAmount(profitability.estimatedOutput)
          }
        };
      }
      
      // Try to get island details for the staking token (for better UI display)
      let poolName = "";
      try {
        const islandDetails = await getIslandDetails(stakingToken);
        if (islandDetails) {
          poolName = `${islandDetails.token0.symbol}-${islandDetails.token1.symbol}`;
        }
      } catch (error) {
        console.error(`Error fetching pool name for ${stakingToken}:`, error);
        // Continue with empty pool name if we can't fetch it
      }
      
      // Execute the compound transaction
      const compoundResult = await compoundBaultWithHelper(
        bault_address as Address,
        wrapper_address as Address,
        profitReceiver as Address
      );
      
      if (compoundResult.status === 'success') {
        return {
          _uiDisplayTool: true,
          summary: `Successfully compounded Bault ${poolName || bault_address}`,
          status: 'success',
          transaction_hash: compoundResult.hash,
          bault_address,
          wrapper_address,
          profit_receiver: profitReceiver,
          pool_name: poolName || undefined,
          profitability: {
            profit: formatAmount(profitability.profit),
            bounty: formatAmount(profitability.bounty),
            wrapperAmount: formatAmount(profitability.wrapperAmount),
            profit_percentage: `${(Number((profitability.profit * BigInt(10000) / profitability.bounty)) / 100).toFixed(2)}%`
          }
        };
      } else {
        return {
          _uiDisplayTool: true,
          summary: `Failed to compound Bault: ${compoundResult.error_message}`,
          status: 'fail',
          error_message: compoundResult.error_message,
          bault_address,
          pool_name: poolName || undefined
        };
      }
    } catch (error) {
      console.error('Error in Kodiak compound Bault tool:', error);
      
      return {
        _uiDisplayTool: true,
        summary: 'Error compounding Kodiak Bault',
        status: 'fail',
        error_message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}) 
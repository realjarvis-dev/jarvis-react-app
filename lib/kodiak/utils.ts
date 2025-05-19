import { ethers } from 'ethers';

/**
 * Converts a tick to a price
 * @param tick The tick to convert
 * @returns The price
 */
export function tickToPrice(tick: number): number {
  return 1.0001 ** tick;
}

/**
 * Formats a price range for display
 * @param lowerTick The lower tick of the range
 * @param upperTick The upper tick of the range
 * @param token0Symbol The symbol of token0
 * @param token1Symbol The symbol of token1
 * @returns Formatted price range string
 */
export function formatPriceRange(
  lowerTick: number,
  upperTick: number,
  token0Symbol: string,
  token1Symbol: string
): string {
  const lowerPrice = tickToPrice(lowerTick);
  const upperPrice = tickToPrice(upperTick);
  
  return `${lowerPrice.toFixed(4)} - ${upperPrice.toFixed(4)} ${token1Symbol}/${token0Symbol}`;
}

/**
 * Format TVL for display
 * @param token0Amount Amount of token0
 * @param token1Amount Amount of token1
 * @param token0Decimals Decimals of token0
 * @param token1Decimals Decimals of token1
 * @param token0Symbol Symbol of token0
 * @param token1Symbol Symbol of token1
 * @returns Formatted TVL string
 */
export function formatTVL(
  token0Amount: string,
  token1Amount: string,
  token0Decimals: number,
  token1Decimals: number,
  token0Symbol: string,
  token1Symbol: string
): string {
  const amt0 = parseFloat(ethers.formatUnits(token0Amount, token0Decimals));
  const amt1 = parseFloat(ethers.formatUnits(token1Amount, token1Decimals));
  
  return `${amt0.toFixed(2)} ${token0Symbol} + ${amt1.toFixed(2)} ${token1Symbol}`;
}

/**
 * Calculate minimum amounts with slippage protection
 * @param amount Amount to apply slippage to
 * @param slippageBPS Slippage in basis points (1 BPS = 0.01%)
 * @returns Minimum amount after slippage
 */
export function calculateMinimumWithSlippage(
  amount: bigint,
  slippageBPS: number
): bigint {
  return amount * BigInt(10000 - slippageBPS) / BigInt(10000);
}

/**
 * Formats APR for display
 * @param apr APR as a decimal (e.g., 0.05 for 5%)
 * @param isEstimate Whether the APR is an estimate
 * @returns Formatted APR string
 */
export function formatAPR(apr: number, isEstimate: boolean = false): string {
  if (apr === 0 && isEstimate) {
    return 'APR unavailable';
  }
  return `${(apr * 100).toFixed(2)}%${isEstimate ? ' (estimated)' : ''}`;
} 
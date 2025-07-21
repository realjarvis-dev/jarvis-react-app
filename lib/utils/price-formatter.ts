/**
 * Centralized price formatting utility
 * 
 * Provides consistent decimal formatting for prices across all components
 */

/**
 * Format price with appropriate decimal places and commas
 * This function ensures consistent decimal formatting across the application
 */
export function formatPrice(price: number): string {
  if (price >= 100) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } else if (price >= 1) {
    return price.toFixed(4)
  } else if (price >= 0.0001) {
    // For values between 0.0001 and 1, use 6 decimal places for consistency
    return price.toFixed(6)
  } else {
    // For very small values, use scientific notation
    return price.toExponential(4)
  }
}

/**
 * Format large numbers with appropriate suffixes (K, M, B, T)
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

/**
 * Format price with dollar sign prefix
 */
export function formatUsdPrice(price: number): string {
  return `$${formatPrice(price)}`
}

/**
 * Format percentage with appropriate decimal places
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`
}
/**
 * Common USD Amount Parser
 * 
 * This utility provides consistent USD amount parsing and token conversion
 * across all tools in the Jarvis investment agent.
 */

import { getTokenUsdPriceBatch } from '../enso/get-token-usd-price'

// Token address mapping for USD conversion (centralized)
export const TOKEN_ADDRESS_MAP: Record<string, string> = {
  ETH: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
  UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  AAVE: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  MKR: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
  COMP: '0xc00e94cb662c3520282e6f5717214004a7f26888'
}

export const TOKEN_DECIMAL_MAP: Record<string, number> = {
  ETH: 18,
  USDT: 6,
  USDC: 6,
  DAI: 18,
  WETH: 18,
  WBTC: 8,
  LINK: 18,
  UNI: 18,
  AAVE: 18,
  MKR: 18,
  COMP: 18,
}

// USD parsing patterns - supports various natural language expressions
const USD_PATTERNS = [
  /^\$(\d+(?:\.\d+)?)$/, // $30, $100.50
  /^(\d+(?:\.\d+)?)\s*usd$/i, // 30 USD, 100.50 usd
  /^(\d+(?:\.\d+)?)\s*dollars?$/i, // 30 dollars, 100.50 dollar
  /^\$(\d+(?:\.\d+)?)\s+(?:of|worth\s+of|in)\s+/i, // $100 of token, $100 worth of token, $100 in token
  /^(\d+(?:\.\d+)?)\s*(?:usd|dollars?)\s+(?:of|worth\s+of|in)\s+/i, // 100 USD of token, 100 dollars worth of token
] as const

export interface UsdConversionResult {
  isUsd: boolean
  tokenAmount?: string
  usdAmount?: number
  originalInput: string
  conversionNote?: string
}

export interface UsdParserOptions {
  /**
   * Chain ID for price lookup (defaults to 1 for Ethereum mainnet)
   */
  chainId?: number
  /**
   * Custom token address mapping (extends default mapping)
   */
  customTokens?: Record<string, string>
  /**
   * Custom decimal mapping (extends default mapping)
   */
  customDecimals?: Record<string, number>
  /**
   * Whether to throw errors or return them in the result
   */
  throwErrors?: boolean
}

/**
 * Checks if a string contains a USD amount pattern
 */
export function detectUsdAmount(amountStr: string): boolean {
  const trimmed = amountStr.trim()
  return USD_PATTERNS.some(pattern => pattern.test(trimmed))
}

/**
 * Extracts the numeric USD value from a USD amount string
 */
export function extractUsdValue(amountStr: string): number | null {
  const trimmed = amountStr.trim()
  
  for (const pattern of USD_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const value = parseFloat(match[1])
      return isNaN(value) || value <= 0 ? null : value
    }
  }
  
  return null
}

/**
 * Parses USD amounts and converts them to token amounts using real-time pricing
 * 
 * @param amountStr The amount string to parse (e.g., "$100", "$100 of ETH", "50 USD")
 * @param tokenSymbol The target token symbol (e.g., "ETH", "LINK", "USDC")
 * @param options Optional configuration for parsing
 * @returns UsdConversionResult with conversion details
 */
export async function parseUsdAmount(
  amountStr: string,
  tokenSymbol: string,
  options: UsdParserOptions = {}
): Promise<UsdConversionResult> {
  const {
    chainId = 1,
    customTokens = {},
    customDecimals = {},
    throwErrors = true
  } = options

  const baseResult: UsdConversionResult = {
    isUsd: false,
    originalInput: amountStr
  }

  // Combine default and custom token mappings
  const tokenAddressMap = { ...TOKEN_ADDRESS_MAP, ...customTokens }
  const tokenDecimalMap = { ...TOKEN_DECIMAL_MAP, ...customDecimals }

  const trimmed = amountStr.trim()

  // Try to match USD patterns
  for (const pattern of USD_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const usdAmount = parseFloat(match[1])
      
      if (isNaN(usdAmount) || usdAmount <= 0) {
        const error = new Error(`Invalid USD amount: ${amountStr}`)
        if (throwErrors) throw error
        return { ...baseResult, conversionNote: error.message }
      }

      // Get token address for price lookup
      const tokenAddress = tokenAddressMap[tokenSymbol.toUpperCase()]
      if (!tokenAddress) {
        const error = new Error(`Token ${tokenSymbol} is not supported for USD conversion`)
        if (throwErrors) throw error
        return { ...baseResult, conversionNote: error.message }
      }

      try {
        // Fetch real-time token price
        const priceData = await getTokenUsdPriceBatch([tokenAddress], chainId)
        
        if (!priceData || priceData.length === 0) {
          const error = new Error(`Market data unavailable for ${tokenSymbol}. Please specify the exact token amount instead of USD amount.`)
          if (throwErrors) throw error
          return { ...baseResult, conversionNote: error.message }
        }

        const tokenPrice = priceData[0].price
        if (!tokenPrice || tokenPrice <= 0) {
          const error = new Error(`Market data unavailable for ${tokenSymbol}. Please specify the exact token amount instead of USD amount.`)
          if (throwErrors) throw error
          return { ...baseResult, conversionNote: error.message }
        }

        // Calculate token amount with appropriate decimals
        const tokenDecimals = tokenDecimalMap[tokenSymbol.toUpperCase()] || 18
        const tokenAmount = (usdAmount / tokenPrice).toFixed(tokenDecimals)

        return {
          isUsd: true,
          tokenAmount,
          usdAmount,
          originalInput: amountStr,
          conversionNote: `Converted $${usdAmount} to ${tokenAmount} ${tokenSymbol.toUpperCase()} using real-time pricing (rate: $${tokenPrice})`
        }

      } catch (error) {
        // Re-throw market data unavailable errors
        if (error instanceof Error && error.message.includes('Market data unavailable')) {
          if (throwErrors) throw error
          return { ...baseResult, conversionNote: error.message }
        }
        
        const convertError = new Error(`Failed to fetch ${tokenSymbol} price for USD conversion: ${error instanceof Error ? error.message : 'Unknown error'}`)
        if (throwErrors) throw convertError
        return { ...baseResult, conversionNote: convertError.message }
      }
    }
  }

  // No USD pattern matched - return as regular token amount
  return baseResult
}

/**
 * Convenience function for tool parameter descriptions
 */
export function getUsdSupportDescription(baseDescription: string): string {
  return `${baseDescription} Also supports USD amounts in various formats: "$30", "$100", "30 USD", "$100 of token", "$100 worth of token", "100 USD of token" - the system will automatically convert to the token amount using real-time market prices. If market data is unavailable for a token, the system will inform the user to specify the exact token amount instead.`
}

/**
 * Creates standardized USD conversion info for tool results
 */
export function createUsdConversionInfo(result: UsdConversionResult) {
  if (!result.isUsd) return null
  
  return {
    original_usd_amount: result.usdAmount,
    converted_token_amount: result.tokenAmount,
    conversion_note: result.conversionNote
  }
}

/**
 * Validates and returns the token amount to use in tool execution
 */
export function getEffectiveAmount(result: UsdConversionResult): string {
  return result.isUsd ? result.tokenAmount! : result.originalInput
}
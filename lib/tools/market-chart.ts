import { tool } from 'ai'
import { z } from 'zod'
import {
  fetchMarketChartWithFallback,
  processMarketChartData
} from '../coingecko/market-chart'
import { NetworkContext } from '../types/context'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

/**
 * Enhanced error categorization and user-friendly messages
 */
function categorizeError(error: any): { category: string; userMessage: string; shouldRetry: boolean } {
  const message = error.message || 'Unknown error'
  
  if (message.includes('Invalid coin ID provided')) {
    return {
      category: 'invalid_input',
      userMessage: 'The coin ID you provided is invalid. Please check the spelling and try again.',
      shouldRetry: false
    }
  }
  
  if (message.includes('404') || message.includes('not found')) {
    return {
      category: 'not_found',
      userMessage: 'This cryptocurrency was not found on CoinGecko. Please check the coin name or symbol and try again.',
      shouldRetry: false
    }
  }
  
  if (message.includes('No market data available')) {
    return {
      category: 'no_data',
      userMessage: 'No market data is available for this cryptocurrency. It might be a new token or not tracked by CoinGecko.',
      shouldRetry: false
    }
  }
  
  if (message.includes('429') || message.includes('rate limit')) {
    return {
      category: 'rate_limited',
      userMessage: 'Too many requests. Please wait a moment and try again.',
      shouldRetry: true
    }
  }
  
  if (message.includes('timeout') || message.includes('AbortError')) {
    return {
      category: 'timeout',
      userMessage: 'Request timed out. Please try again.',
      shouldRetry: true
    }
  }
  
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return {
      category: 'server_error',
      userMessage: 'CoinGecko is temporarily unavailable. Please try again in a few minutes.',
      shouldRetry: true
    }
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return {
      category: 'network_error',
      userMessage: 'Network error occurred. Please check your connection and try again.',
      shouldRetry: true
    }
  }
  
  return {
    category: 'unknown',
    userMessage: 'An unexpected error occurred. Please try again.',
    shouldRetry: true
  }
}

export const marketChartTool = tool({
  description:
    'Fetch and display cryptocurrency market chart data from CoinGecko. This tool automatically renders a market chart UI with price history, statistics, and trends. Supports common coin symbols (BTC, ETH, SOL) and full names.',
  parameters: z.object({
    coin_id: z
      .string()
      .describe(
        'The cryptocurrency identifier. Can be a CoinGecko coin ID (e.g., "bitcoin", "ethereum"), common symbols (e.g., "BTC", "ETH", "SOL"), or full names (e.g., "Bitcoin", "Ethereum"). The system will automatically resolve the correct identifier.'
      ),
    days: z
      .number()
      .min(1)
      .max(365)
      .default(7)
      .describe(
        'Number of days of historical data to fetch (default: 7, max: 365)'
      ),
    currency: z
      .string()
      .default('usd')
      .describe('Target currency for price data (default: "usd")')
  }),
  execute: async (params, context?: ToolContext) => {
    console.log('market_chart tool called', params)
    const { coin_id, days = 7, currency = 'usd' } = params

    // Input validation
    if (!coin_id || typeof coin_id !== 'string' || coin_id.trim().length === 0) {
      const errorData = {
        success: false,
        error: 'Invalid coin ID provided',
        coin_id: coin_id || 'undefined',
        currency,
        days,
        error_category: 'invalid_input',
        user_message: 'Please provide a valid cryptocurrency name or symbol.',
        suggestions: [
          'Try using common symbols like "BTC", "ETH", "SOL"',
          'Use full names like "Bitcoin", "Ethereum", "Solana"',
          'Check the spelling of the cryptocurrency name'
        ]
      }

      return {
        _uiDisplayTool: true,
        summary: `Invalid coin ID: ${coin_id}`,
        data: errorData
      }
    }

    try {
      console.log(`Fetching market chart for ${coin_id} with ${days} days of data`)
      
      // Use the robust fetching mechanism with fallbacks
      const rawData = await fetchMarketChartWithFallback(coin_id, days, currency)

      // Process the data into a more usable format
      const processedData = processMarketChartData(
        rawData,
        coin_id,
        currency,
        days
      )

      // Return data in the format expected by the UI component
      const chartData = {
        success: true,
        coin_id: coin_id,
        currency: currency.toUpperCase(),
        days: days,
        data_points: processedData.data.length,
        market_data: processedData.data,
        current_price: processedData.currentPrice,
        complete_time: new Date().toISOString(),
        fetch_method: 'robust_with_fallback'
      }

      return {
        _uiDisplayTool: true,
        summary: `Successfully fetched ${days}-day market chart for ${coin_id}: ${processedData.data.length} data points, current price: $${processedData.currentPrice.toFixed(6)}`,
        data: chartData
      }
    } catch (error: any) {
      console.error('Error in market chart tool:', error)

      // Categorize the error for better user experience
      const errorInfo = categorizeError(error)
      
      // Return detailed error data that the UI can display
      const errorData = {
        success: false,
        error: error.message || 'Failed to fetch market chart data',
        coin_id,
        currency,
        days,
        error_category: errorInfo.category,
        user_message: errorInfo.userMessage,
        should_retry: errorInfo.shouldRetry,
        suggestions: getSuggestions(coin_id, errorInfo.category),
        attempted_fallbacks: true,
        debug_info: {
          original_coin_id: coin_id,
          sanitized_coin_id: coin_id.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          error_type: error.name,
          timestamp: new Date().toISOString()
        }
      }

      return {
        _uiDisplayTool: true,
        summary: `Error fetching market chart for ${coin_id}: ${errorInfo.userMessage}`,
        data: errorData
      }
    }
  }
})

/**
 * Provides helpful suggestions based on error category
 */
function getSuggestions(coinId: string, errorCategory: string): string[] {
  const commonSuggestions = [
    'Try using common symbols like "BTC", "ETH", "SOL", "ADA"',
    'Use full names like "Bitcoin", "Ethereum", "Solana", "Cardano"',
    'Check the spelling of the cryptocurrency name'
  ]

  switch (errorCategory) {
    case 'not_found':
      return [
        ...commonSuggestions,
        'Search for the coin on CoinGecko.com first to find the correct ID',
        'Some newer tokens might not be available on CoinGecko yet'
      ]
    
    case 'no_data':
      return [
        'Try a different time period (e.g., 1 day instead of 7 days)',
        'This might be a very new token with limited data',
        'Check if the token is actively traded'
      ]
    
    case 'rate_limited':
      return [
        'Wait a few minutes before trying again',
        'Avoid making too many requests in a short time'
      ]
    
    case 'timeout':
    case 'network_error':
      return [
        'Check your internet connection',
        'Try again in a few moments',
        'The CoinGecko API might be temporarily slow'
      ]
    
    case 'server_error':
      return [
        'CoinGecko is experiencing temporary issues',
        'Try again in a few minutes',
        'Check CoinGecko status page for updates'
      ]
    
    default:
      return commonSuggestions
  }
}

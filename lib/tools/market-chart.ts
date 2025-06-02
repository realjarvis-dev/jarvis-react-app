import { tool } from 'ai'
import { z } from 'zod'
import { fetchMarketChart, processMarketChartData } from '../coingecko/market-chart'
import { NetworkContext } from '../utils/tool-registry'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const marketChartTool = tool({
  description: 'Fetch and display cryptocurrency market chart data from CoinGecko. This tool automatically renders a market chart UI with price history, statistics, and trends.',
  parameters: z.object({
    coin_id: z.string()
      .describe('The CoinGecko coin ID (e.g., "bitcoin", "ethereum", "solana", "cardano")'),
    days: z.number()
      .min(1)
      .max(365)
      .default(7)
      .describe('Number of days of historical data to fetch (default: 7, max: 365)'),
    currency: z.string()
      .default('usd')
      .describe('Target currency for price data (default: "usd")')
  }),
  execute: async (params, context?: ToolContext) => {
    const { coin_id, days = 7, currency = 'usd' } = params;
    
    try {
      // Fetch raw market chart data from CoinGecko
      const rawData = await fetchMarketChart(coin_id, days, currency)
      
      // Process the data into a more usable format
      const processedData = processMarketChartData(rawData, coin_id, currency, days)
      
      // Return data in the format expected by the UI component
      const chartData = {
        success: true,
        coin_id: coin_id,
        currency: currency.toUpperCase(),
        days: days,
        data_points: processedData.data.length,
        market_data: processedData.data,
        complete_time: new Date().toISOString()
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Fetched ${days}-day market chart for ${coin_id}: ${processedData.data.length} data points`,
        data: chartData
      }
    } catch (error: any) {
      console.error('Error in market chart tool:', error)
      
      // Return error data that the UI can display
      const errorData = {
        success: false,
        error: error.message || 'Failed to fetch market chart data',
        coin_id,
        currency,
        days
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Error fetching market chart for ${coin_id}: ${error.message || 'Unknown error'}`,
        data: errorData
      }
    }
  }
}) 
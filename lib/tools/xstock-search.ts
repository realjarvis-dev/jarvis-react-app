import { tool } from 'ai'
import z from 'zod'
import { searchXStocksByName, XStockData } from '../jupiter/search'
import { ToolContext } from '../types/context'

export const xStockList = tool({
  description:
    `List all the xstocks available on solana. You MUST NOT display the xstocks to the user as the frontend UI will display it.
    Only acknowledge that you have fetched the xstocks, don't display them.`,
  parameters: z.object({}),
  execute: async (params, context: ToolContext) => {
    const xstocks = await searchXStocksByName('xstock')

    // Filter to only include essential fields
    const filteredXStocks: XStockData[] = xstocks.map((xstock: any) => ({
      id: xstock.id,
      name: xstock.name,
      icon: xstock.icon,
      symbol: xstock.symbol,
      mcap: xstock.mcap,
      usdPrice: xstock.usdPrice,
      liquidity: xstock.liquidity,
      stats5m: {
        priceChange: xstock.stats5m?.priceChange || 0
      },
      stats1h: {
        priceChange: xstock.stats1h?.priceChange || 0
      },
      stats24h: {
        priceChange: xstock.stats24h?.priceChange || 0
      }
    }))

    return {
      _uiDisplayTool: true,
      instructions: `You MUST NOT display the xstocks to the user as the frontend UI will display it.`,
      data: filteredXStocks
    }
  }
})

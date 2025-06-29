import { tool } from 'ai'
import { z } from 'zod'
import { fetchYields, getHighYieldOpportunities, filterYields } from '../defillama/api'

export const defiYieldsTool = tool({
  description: 'Discover high-yield DeFi opportunities across different protocols and chains. Find the best yield farming and staking opportunities.',
  parameters: z.object({
    chain: z.string().optional().describe('Filter by blockchain (e.g., "Ethereum", "Arbitrum", "Base")'),
    project: z.string().optional().describe('Filter by protocol name (e.g., "Aave", "Compound", "Uniswap")'),
    minTvl: z.number().optional().describe('Minimum pool TVL in USD (default: 100,000)'),
    minApy: z.number().optional().describe('Minimum APY percentage (default: 5%)'),
    stablecoin: z.boolean().optional().describe('Filter for stablecoin pools only'),
    sortBy: z.enum(['apy', 'tvlUsd', 'apyBase', 'apyReward']).default('apy').describe('Sort criteria'),
    limit: z.number().min(1).max(50).default(20).describe('Number of results to return')
  }),
  execute: async ({ chain, project, minTvl, minApy, stablecoin, sortBy, limit }) => {
    try {
      const allYields = await fetchYields()
      
      if (!Array.isArray(allYields)) {
        throw new Error('Invalid yields data format')
      }

      const filteredYields = filterYields(allYields, {
        chain,
        project,
        minTvl: minTvl || 100_000,
        minApy: minApy || 5,
        stablecoin,
        sortBy,
        sortOrder: 'desc',
        limit
      })

      // Calculate some statistics
      const averageApy = filteredYields.reduce((sum, y) => sum + y.apy, 0) / filteredYields.length
      const totalTvl = filteredYields.reduce((sum, y) => sum + y.tvlUsd, 0)
      const uniqueChains = [...new Set(filteredYields.map(y => y.chain))].length
      const uniqueProjects = [...new Set(filteredYields.map(y => y.project))].length

      return {
        _uiDisplayTool: true,
        summary: `Found ${filteredYields.length} high-yield DeFi opportunities across ${uniqueChains} chains and ${uniqueProjects} protocols. Average APY: ${averageApy.toFixed(2)}%`,
        data: { 
          yields: filteredYields,
          statistics: {
            averageApy: averageApy,
            totalTvl: totalTvl,
            uniqueChains: uniqueChains,
            uniqueProjects: uniqueProjects,
            highestApy: filteredYields[0]?.apy || 0,
            filters: { chain, project, minTvl, minApy, stablecoin }
          }
        }
      }
    } catch (error) {
      console.error('DeFiLlama yields tool error:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Failed to fetch DeFi yield data',
        data: { 
          yields: [], 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    }
  }
})
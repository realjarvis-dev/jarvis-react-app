import { tool } from 'ai'
import { z } from 'zod'
import { fetchYields, getHighYieldOpportunities, filterYields, fetchProtocols } from '../defillama/api'
import { sanitizeProtocol, getRiskLevel, getMomentum } from '../defillama/utils'

export const defiYieldsTool = tool({
  description: 'Discover high-yield DeFi opportunities across different protocols and chains. Find the best yield farming and staking opportunities.',
  parameters: z.object({
    chain: z.string().optional().describe('Filter by blockchain (e.g., "Ethereum", "Arbitrum", "Base")'),
    project: z.string().optional().describe('Filter by protocol name (e.g., "Aave", "Compound", "Uniswap")'),
    minTvl: z.number().optional().describe('Minimum pool TVL in USD (default: 100,000)'),
    minApy: z.number().optional().describe('Minimum APY percentage (default: 5%)'),
    stablecoin: z.boolean().optional().describe('Filter for stablecoin pools only'),
    sortBy: z.enum(['apy', 'tvlUsd', 'apyBase', 'apyReward']).default('apy').describe('Sort criteria'),
    includeProtocolAnalysis: z.boolean().default(false).describe('Include underlying protocol analysis (TVL, growth, risk assessment)'),
    limit: z.number().min(1).max(50).default(20).describe('Number of results to return')
  }),
  execute: async ({ chain, project, minTvl, minApy, stablecoin, sortBy, includeProtocolAnalysis, limit }) => {
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

      // Fetch protocol analysis if requested
      let protocolAnalysis = null
      if (includeProtocolAnalysis) {
        console.log('📊 Fetching protocol analysis for yield opportunities...')
        try {
          const rawProtocols = await fetchProtocols()
          const protocols = rawProtocols
            .map(sanitizeProtocol)
            .filter((p): p is NonNullable<typeof p> => p !== null)

          // Match yields with their protocols and add analysis
          const protocolMap = new Map(protocols.map(p => [p.name.toLowerCase(), p]))
          
          protocolAnalysis = filteredYields.map(yieldData => {
            const protocol = protocolMap.get(yieldData.project.toLowerCase())
            if (protocol) {
              return {
                project: yieldData.project,
                protocol: {
                  tvl: protocol.tvl,
                  change_7d: protocol.change_7d,
                  change_1d: protocol.change_1d,
                  category: protocol.category,
                  chains: protocol.chains,
                  audits: protocol.audits,
                  riskLevel: getRiskLevel(protocol),
                  momentum: getMomentum(protocol)
                }
              }
            }
            return null
          }).filter(Boolean)

          console.log(`✨ Generated protocol analysis for ${protocolAnalysis.length} protocols`)
        } catch (error) {
          console.warn('⚠️ Failed to fetch protocol analysis:', error)
        }
      }

      return {
        _uiDisplayTool: true,
        summary: `Found ${filteredYields.length} high-yield DeFi opportunities across ${uniqueChains} chains and ${uniqueProjects} protocols. Average APY: ${averageApy.toFixed(2)}%${includeProtocolAnalysis ? ' Including protocol risk analysis.' : ''}`,
        data: { 
          yields: filteredYields,
          protocolAnalysis: protocolAnalysis || [],
          includeProtocolAnalysis,
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
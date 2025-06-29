import { tool } from 'ai'
import { z } from 'zod'
import { fetchProtocols, fetchYields } from '../defillama/api'
import { analyzeDeFiOpportunities, sanitizeProtocol } from '../defillama/utils'

export const defiOpportunitiesTool = tool({
  description: 'Hunt for DeFi opportunities by analyzing top-performing protocols with high TVL growth, yield opportunities, and momentum analysis. Perfect for finding where money is flowing and why.',
  parameters: z.object({
    minTvl: z.number().default(1_000_000).describe('Minimum TVL threshold in USD (default: $1M)'),
    minGrowth: z.number().default(10).describe('Minimum 7-day growth percentage (default: 10%)'),
    includeYields: z.boolean().default(true).describe('Include related yield opportunities analysis'),
    limit: z.number().min(5).max(30).default(15).describe('Number of opportunities to analyze')
  }),
  execute: async ({ minTvl, minGrowth, includeYields, limit }) => {
    try {
      // Fetch protocols data
      const rawProtocols = await fetchProtocols()
      const protocols = rawProtocols
        .map(sanitizeProtocol)
        .filter((p): p is NonNullable<typeof p> => p !== null)

      // Fetch yields data if requested
      let yields: any[] = []
      if (includeYields) {
        try {
          yields = await fetchYields()
        } catch (error) {
          console.warn('Failed to fetch yields data:', error)
        }
      }

      // Find top opportunities based on criteria
      const topOpportunities = protocols
        .filter(p => 
          p.tvl >= minTvl && 
          p.change_7d !== null && 
          p.change_7d >= minGrowth
        )
        .sort((a, b) => (b.change_7d || 0) - (a.change_7d || 0))
        .slice(0, limit)

      if (topOpportunities.length === 0) {
        return {
          _uiDisplayTool: true,
          summary: `No DeFi opportunities found matching criteria: TVL > $${(minTvl / 1_000_000).toFixed(1)}M and 7d growth > ${minGrowth}%`,
          data: { 
            opportunities: [],
            criteria: { minTvl, minGrowth, includeYields },
            totalProtocolsAnalyzed: protocols.length
          }
        }
      }

      // Analyze opportunities
      const opportunities = includeYields 
        ? analyzeDeFiOpportunities(topOpportunities, yields)
        : topOpportunities.map(protocol => ({
            protocol,
            opportunities: {
              tvlGrowth: protocol.change_7d || 0,
              yieldOpportunities: [],
              riskLevel: 'medium' as const,
              momentum: 'moderate' as const
            }
          }))

      // Calculate summary statistics
      const totalTvl = opportunities.reduce((sum, opp) => sum + opp.protocol.tvl, 0)
      const averageGrowth = opportunities.reduce((sum, opp) => sum + (opp.protocol.change_7d || 0), 0) / opportunities.length
      const categoriesRepresented = [...new Set(opportunities.map(opp => opp.protocol.category))].length
      const chainsRepresented = [...new Set(opportunities.flatMap(opp => opp.protocol.chains))].length

      return {
        _uiDisplayTool: true,
        summary: `🎯 Found ${opportunities.length} hot DeFi opportunities! Average 7d growth: ${averageGrowth.toFixed(1)}%. Total TVL: $${(totalTvl / 1_000_000_000).toFixed(2)}B across ${categoriesRepresented} categories and ${chainsRepresented} chains. Follow the money flow! 💰`,
        data: { 
          opportunities,
          analysis: {
            totalTvl,
            averageGrowth,
            categoriesRepresented,
            chainsRepresented,
            criteria: { minTvl, minGrowth, includeYields },
            totalProtocolsAnalyzed: protocols.length,
            opportunitiesFound: opportunities.length
          }
        }
      }
    } catch (error) {
      console.error('DeFiLlama opportunities tool error:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Failed to analyze DeFi opportunities',
        data: { 
          opportunities: [], 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    }
  }
})
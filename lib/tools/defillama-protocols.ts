import { tool } from 'ai'
import { z } from 'zod'
import { 
  fetchProtocols, 
  getTopGainers, 
  getTopProtocolsByTVL, 
  filterProtocols,
  fetchYields
} from '../defillama/api'
import { sanitizeProtocol, analyzeDeFiOpportunities } from '../defillama/utils'

export const defiProtocolsTool = tool({
  description: 'Get comprehensive DeFi protocol data including top protocols by TVL, trending gainers, and custom filtered results. Supports all major chains and categories.',
  parameters: z.object({
    category: z.string().optional().describe('Filter by protocol category (e.g., "Lending", "DEX", "Liquid Staking")'),
    chain: z.string().optional().describe('Filter by blockchain (e.g., "Ethereum", "Arbitrum", "Base")'),
    minTvl: z.number().optional().describe('Minimum TVL in USD (default: 1,000,000)'),
    sortBy: z.enum(['tvl', 'change_7d', 'change_1d', 'change_1h']).optional().describe('Sort criteria'),
    view: z.enum(['top_tvl', 'top_gainers', 'custom']).default('top_tvl').describe('View type: top_tvl for major protocols by TVL (default for general queries), top_gainers for trending/hot protocols (use when user asks about "gainers", "trending", "hot"), custom for specific filters'),
    includeYieldOpportunities: z.boolean().default(false).describe('Include related yield farming opportunities for each protocol'),
    limit: z.number().min(1).max(50).default(20).describe('Number of results to return')
  }),
  execute: async ({ category, chain, minTvl, sortBy, view, includeYieldOpportunities, limit }) => {
    try {
      console.log('🚀 Starting DeFiLlama protocols tool execution...')
      const rawProtocols = await fetchProtocols()
      console.log(`📊 Processing ${rawProtocols.length} raw protocols`)
      
      // Sanitize and filter out invalid protocols
      const protocols = rawProtocols
        .map(sanitizeProtocol)
        .filter((p): p is NonNullable<typeof p> => p !== null)
      
      console.log(`✨ Sanitized ${protocols.length} valid protocols`)

      let filteredProtocols

      switch (view) {
        case 'top_tvl':
          filteredProtocols = getTopProtocolsByTVL(protocols, limit)
          break
        case 'top_gainers':
          filteredProtocols = getTopGainers(protocols, limit)
          break
        case 'custom':
          filteredProtocols = filterProtocols(protocols, {
            category,
            chain,
            minTvl: minTvl || 1_000_000,
            sortBy: sortBy || 'tvl',
            sortOrder: 'desc',
            limit
          })
          break
        default:
          filteredProtocols = getTopProtocolsByTVL(protocols, limit)
      }

      console.log(`🎯 Filtered to ${filteredProtocols.length} protocols for view: ${view}`)

      // Fetch yield opportunities if requested
      let opportunities = null
      if (includeYieldOpportunities) {
        console.log('📈 Fetching yield opportunities for cross-reference...')
        try {
          const yields = await fetchYields()
          opportunities = analyzeDeFiOpportunities(filteredProtocols, yields)
          console.log(`✨ Generated ${opportunities.length} opportunity analyses`)
        } catch (error) {
          console.warn('⚠️ Failed to fetch yield opportunities:', error)
        }
      }

      const summary = view === 'top_tvl'
        ? `Found ${filteredProtocols.length} top DeFi protocols by Total Value Locked (TVL) - the major players in DeFi${includeYieldOpportunities ? ' with related yield opportunities.' : ''}`
        : view === 'top_gainers' 
        ? `Found ${filteredProtocols.length} trending DeFi protocols with highest 7-day gains (TVL > $1M)${includeYieldOpportunities ? ' with related yield opportunities.' : ''}`
        : `Found ${filteredProtocols.length} DeFi protocols matching your criteria${includeYieldOpportunities ? ' with related yield opportunities.' : ''}`

      const result = {
        _uiDisplayTool: true,
        summary,
        data: { 
          protocols: filteredProtocols,
          opportunities: opportunities || [],
          view,
          includeYields: includeYieldOpportunities,
          totalProtocols: protocols.length,
          averageTvl: protocols.reduce((sum, p) => sum + p.tvl, 0) / protocols.length
        }
      }

      console.log('✅ DeFiLlama protocols tool execution completed successfully')
      return result
    } catch (error) {
      console.error('DeFiLlama protocols tool error:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Failed to fetch DeFi protocol data',
        data: { 
          protocols: [], 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    }
  }
})
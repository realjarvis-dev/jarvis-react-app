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
  description: 'Get comprehensive DeFi protocol data including top protocols by TVL, trending gainers, specific protocol details, and custom filtered results. Supports all major chains and categories.',
  parameters: z.object({
    protocolName: z.string().optional().describe('Search for a specific protocol by name (e.g., "Aave", "Uniswap", "Compound")'),
    category: z.string().optional().describe('Filter by protocol category (e.g., "Lending", "DEX", "Liquid Staking")'),
    chain: z.string().optional().describe('Filter by blockchain (e.g., "Ethereum", "Arbitrum", "Base")'),
    minTvl: z.number().optional().describe('Minimum TVL in USD (default: 1,000,000)'),
    sortBy: z.enum(['tvl', 'change_7d', 'change_1d', 'change_1h']).optional().describe('Sort criteria'),
    view: z.enum(['top_tvl', 'top_gainers', 'custom', 'protocol_search']).default('top_tvl').describe('View type: top_tvl for major protocols by TVL (default for general queries), top_gainers for trending/hot protocols (use when user asks about "gainers", "trending", "hot"), custom for specific filters, protocol_search for specific protocol lookup'),
    includeYieldOpportunities: z.boolean().default(false).describe('Include related yield farming opportunities for each protocol'),
    limit: z.number().min(1).max(50).default(20).describe('Number of results to return')
  }),
  execute: async ({ protocolName, category, chain, minTvl, sortBy, view, includeYieldOpportunities, limit }) => {
    try {
      console.log('🚀 Starting DeFiLlama protocols tool execution...')
      
      // Set a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000)
      })
      
      const dataPromise = fetchProtocols()
      const rawProtocols = await Promise.race([dataPromise, timeoutPromise]) as any[]
      console.log(`📊 Processing ${rawProtocols.length} raw protocols`)
      
      // Sanitize and filter out invalid protocols
      const protocols = rawProtocols
        .map(sanitizeProtocol)
        .filter((p): p is NonNullable<typeof p> => p !== null)
      
      console.log(`✨ Sanitized ${protocols.length} valid protocols`)

      let filteredProtocols

      // Handle protocol-specific search
      if (protocolName || view === 'protocol_search') {
        if (!protocolName) {
          throw new Error('Protocol name is required for protocol search')
        }
        
        console.log(`🔍 Searching for specific protocol: "${protocolName}"`)
        const searchTerm = protocolName.toLowerCase().trim()
        
        // Find protocols that match the search term
        const matchingProtocols = protocols.filter(p => 
          p.name.toLowerCase().includes(searchTerm) ||
          p.slug?.toLowerCase().includes(searchTerm) ||
          p.symbol?.toLowerCase().includes(searchTerm)
        )
        
        console.log(`🎯 Found ${matchingProtocols.length} protocols matching "${protocolName}"`)
        
        if (matchingProtocols.length === 0) {
          // Suggest similar protocols
          const suggestions = protocols
            .filter(p => {
              const name = p.name.toLowerCase()
              const slug = p.slug?.toLowerCase() || ''
              return name.includes(searchTerm.substring(0, 3)) || slug.includes(searchTerm.substring(0, 3))
            })
            .slice(0, 5)
            .map(p => p.name)
          
          throw new Error(`No protocols found matching "${protocolName}". Did you mean: ${suggestions.join(', ')}?`)
        }
        
        filteredProtocols = matchingProtocols.slice(0, limit)
      } else {
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

      const summary = protocolName || view === 'protocol_search'
        ? `Found ${filteredProtocols.length} protocol(s) matching "${protocolName}"${includeYieldOpportunities ? ' with related yield opportunities.' : ''}`
        : view === 'top_tvl'
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
          view: protocolName ? 'protocol_search' : view,
          searchTerm: protocolName,
          includeYields: includeYieldOpportunities,
          totalProtocols: protocols.length,
          averageTvl: protocols.reduce((sum, p) => sum + p.tvl, 0) / protocols.length
        }
      }

      console.log('✅ DeFiLlama protocols tool execution completed successfully')
      return result
    } catch (error) {
      console.error('DeFiLlama protocols tool error:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Unknown error occurred'
      let summary = 'Failed to fetch DeFi protocol data'
      
      if (error instanceof Error) {
        errorMessage = error.message
        
        if (error.message.includes('timed out')) {
          summary = 'Request timed out - DeFiLlama API is slow or unavailable'
          errorMessage = 'The request took too long to complete. Please try again in a few moments.'
        } else if (error.message.includes('No protocols found matching')) {
          summary = 'Protocol not found'
        } else if (error.message.includes('Failed to fetch')) {
          summary = 'Connection error - unable to reach DeFiLlama API'
          errorMessage = 'Could not connect to DeFiLlama API. Please check your internet connection and try again.'
        }
      }
      
      return {
        _uiDisplayTool: true,
        summary,
        data: { 
          protocols: [], 
          error: errorMessage,
          searchTerm: protocolName || undefined
        }
      }
    }
  }
})
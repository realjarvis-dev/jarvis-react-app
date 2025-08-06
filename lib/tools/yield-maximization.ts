import { tool } from 'ai'
import { z } from 'zod'
import { getUserEvmWalletAddress } from '../privy/client'
import { ToolContext } from '../types/context'
import { getYieldAggregator, UnifiedYieldOpportunity } from '../utils/yield-aggregator'

/**
 * Calculate summary statistics for opportunities
 */
function calculateOpportunityStats(opportunities: UnifiedYieldOpportunity[]) {
  if (opportunities.length === 0) {
    return {
      averageApy: 0,
      highestApy: 0,
      lowestApy: 0,
      totalTvl: 0,
      protocolDistribution: {},
      riskDistribution: {}
    }
  }

  const apys = opportunities.map(o => o.apy)
  const protocolCounts = opportunities.reduce((acc, o) => {
    acc[o.protocol] = (acc[o.protocol] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const riskCounts = opportunities.reduce((acc, o) => {
    acc[o.riskLevel] = (acc[o.riskLevel] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    averageApy: apys.reduce((sum, apy) => sum + apy, 0) / apys.length,
    highestApy: Math.max(...apys),
    lowestApy: Math.min(...apys),
    totalTvl: opportunities.reduce((sum, o) => sum + o.tvl, 0),
    protocolDistribution: protocolCounts,
    riskDistribution: riskCounts
  }
}

/**
 * Get execution hint for an opportunity
 */
function getExecutionHint(opportunity: UnifiedYieldOpportunity): string {
  switch (opportunity.protocol) {
    case 'pendle':
      return `Use "pendle_zap_in" tool to enter this ${opportunity.category} position. Exit via ${opportunity.exitMethod}.`
    default:
      return 'Execution method to be determined.'
  }
}

/**
 * Get next steps recommendations
 */
function getNextSteps(opportunities: UnifiedYieldOpportunity[]): string[] {
  const steps: string[] = []
  
  if (opportunities.length > 0) {
    const topOpp = opportunities[0]
    steps.push(`💡 Best opportunity: ${topOpp.name} at ${topOpp.apy.toFixed(2)}% APY`)
    
    if (topOpp.protocol === 'pendle') {
      steps.push(`📝 To enter: Say "zap into ${topOpp.symbol}" or "invest in ${topOpp.name}"`)
    }
    
    if (opportunities.length > 1) {
      steps.push(`🔄 Compare: Review other opportunities and their risk levels before deciding`)
    }
    
    if (topOpp.metadata.maturityDate) {
      const expiry = new Date(topOpp.metadata.maturityDate)
      const daysToExpiry = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysToExpiry < 90) {
        steps.push(`⚠️ Note: This position expires in ${daysToExpiry} days`)
      }
    }
  }
  
  return steps
}

/**
 * Get portfolio recommendation
 */
function getPortfolioRecommendation(opportunities: UnifiedYieldOpportunity[]): string {
  if (opportunities.length === 0) return 'No opportunities found for current criteria.'
  
  const topOpp = opportunities[0]
  const stablecoinOpps = opportunities.filter(o => o.metadata.isStablecoin)
  const volatileOpps = opportunities.filter(o => !o.metadata.isStablecoin)
  
  let recommendation = `Consider moving funds to ${topOpp.name} (${topOpp.apy.toFixed(2)}% APY) for maximum yield. `
  
  if (stablecoinOpps.length > 0 && volatileOpps.length > 0) {
    recommendation += `For balanced risk, consider splitting between stablecoin yield (${stablecoinOpps[0].apy.toFixed(2)}% APY) and volatile assets (${volatileOpps[0].apy.toFixed(2)}% APY).`
  }
  
  return recommendation
}

export const yieldMaximizationTool = tool({
  description: 'Find and analyze the highest yielding Pendle opportunities. This tool scans Pendle markets for yield tokenization opportunities and ranks them by risk-adjusted returns.',
  parameters: z.object({
    action: z.enum(['discover', 'analyze']).default('discover')
      .describe('Action to perform: "discover" to find opportunities, "analyze" to analyze current portfolio vs opportunities'),
    riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate')
      .describe('Risk tolerance: conservative (low risk only), moderate (low-medium risk), aggressive (all risk levels)'),
    minApy: z.number().optional()
      .describe('Minimum APY percentage (e.g., 5 for 5% APY). Optional.'),
    maxApy: z.number().optional()
      .describe('Maximum APY percentage (e.g., 50 for 50% APY). Optional.'),
    includeStablecoins: z.boolean().optional()
      .describe('If true, only show stablecoin opportunities'),
    excludeStablecoins: z.boolean().optional()
      .describe('If true, exclude all stablecoin opportunities'),
    minTvl: z.number().optional()
      .describe('Minimum Total Value Locked in USD (default: 100,000)'),
    maxResults: z.number().min(1).max(20).default(10)
      .describe('Maximum number of opportunities to return (default: 10)')
  }),
  execute: async (params, context: ToolContext) => {
    try {
      const {
        action,
        riskLevel,
        minApy,
        maxApy,
        includeStablecoins,
        excludeStablecoins,
        minTvl,
        maxResults
      } = params

      console.log('🎯 yield_maximization: Starting Pendle yield discovery...')

      // Get user wallet address
      const walletAddress = await getUserEvmWalletAddress()
      if (!walletAddress) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Wallet address not found. Please ensure you are logged in.'
        }
      }

      // Get network context
      const chainId = context?.networkContext?.selectedChainId || 1
      const isDemo = context?.networkContext?.isDemo || false
      const networkId = context?.networkContext?.selectedNetwork || 'ethereum'

      // Only allow on ethereum and demo networks for now
      if (networkId !== 'ethereum' && networkId !== 'demo') {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Yield maximization is only available on Ethereum and Demo networks.'
        }
      }

      console.log(`🔍 Scanning Pendle opportunities on ${networkId} (chainId: ${chainId})...`)

      // Get yield aggregator and fetch opportunities
      const aggregator = getYieldAggregator()
      const opportunities = await aggregator.getYieldOpportunities({
        minApy,
        maxApy,
        riskLevel,
        includeStablecoins,
        excludeStablecoins,
        minTvl,
        chainId,
        isDemo
      })

      if (opportunities.length === 0) {
        return {
          _uiDisplayTool: true,
          success: true,
          message: 'No Pendle yield opportunities found matching your criteria.',
          data: {
            opportunities: [],
            searchCriteria: {
              riskLevel,
              minApy,
              maxApy,
              chainId,
              networkId
            }
          }
        }
      }

      // Limit results
      const limitedOpportunities = opportunities.slice(0, maxResults)

      // Calculate summary statistics
      const stats = calculateOpportunityStats(limitedOpportunities)

      if (action === 'discover') {
        return {
          _uiDisplayTool: true,
          success: true,
          summary: `Found ${limitedOpportunities.length} Pendle yield opportunities. Best opportunity: ${limitedOpportunities[0]?.name} at ${limitedOpportunities[0]?.apy.toFixed(2)}% APY`,
          data: {
            action: 'discover',
            opportunities: limitedOpportunities.map(opp => ({
              id: opp.id,
              protocol: opp.protocol,
              name: opp.name,
              symbol: opp.symbol,
              apy: opp.apy,
              tvl: opp.tvl,
              riskLevel: opp.riskLevel,
              category: opp.category,
              chain: opp.chain,
              entryMethod: opp.entryMethod,
              exitMethod: opp.exitMethod,
              isStablecoin: opp.metadata.isStablecoin,
              hasImpermanentLoss: opp.metadata.hasImpermanentLoss,
              maturityDate: opp.metadata.maturityDate,
              // Add execution hints
              executionHint: getExecutionHint(opp)
            })),
            statistics: stats,
            searchCriteria: {
              riskLevel,
              minApy,
              maxApy,
              chainId,
              networkId,
              totalFound: opportunities.length,
              totalShown: limitedOpportunities.length
            },
            nextSteps: getNextSteps(limitedOpportunities)
          }
        }
      } else {
        // action === 'analyze'
        // TODO: Implement portfolio analysis vs opportunities
        // This would compare current holdings with best opportunities
        return {
          _uiDisplayTool: true,
          success: true,
          summary: 'Portfolio analysis feature coming soon. For now, showing best Pendle opportunities.',
          data: {
            action: 'analyze',
            opportunities: limitedOpportunities.slice(0, 5), // Show top 5 for analysis
            statistics: stats,
            recommendation: getPortfolioRecommendation(limitedOpportunities)
          }
        }
      }

    } catch (error) {
      console.error('Yield maximization tool error:', error)
      return {
        _uiDisplayTool: true,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Pendle yield opportunities'
      }
    }
  }
})

// Export individual functions for testing
export {
    calculateOpportunityStats,
    getExecutionHint,
    getNextSteps,
    getPortfolioRecommendation
}

import { tool } from 'ai'
import { z } from 'zod'
import { getUserEvmWalletAddress } from '../privy/client'
import { ToolContext } from '../types/context'
import { getYieldAggregator, UnifiedYieldOpportunity } from '../utils/yield-aggregator'

/**
 * Parse ETH amount string to standardized format
 */
function parseEthAmount(amount: string): { amountEth: string; isValid: boolean } {
  // Remove "ETH" suffix if present and clean up
  const cleanAmount = amount.replace(/eth/i, '').trim()
  
  // Parse as decimal number
  const ethAmount = parseFloat(cleanAmount)
  if (isNaN(ethAmount) || ethAmount <= 0) {
    return { amountEth: '0', isValid: false }
  }
  
  return {
    amountEth: ethAmount.toString(),
    isValid: true
  }
}

/**
 * Validate execution safety
 */
function validateExecution(opportunity: UnifiedYieldOpportunity, amountEth: string): { 
  canExecute: boolean; 
  warnings: string[]; 
  requiresConfirmation: boolean 
} {
  const warnings: string[] = []
  let requiresConfirmation = false
  
  // Risk level validation
  if (opportunity.riskLevel === 'high') {
    warnings.push(`⚠️ High risk opportunity (${opportunity.apy.toFixed(2)}% APY)`)
    requiresConfirmation = true
  }
  
  // Amount validation
  const amount = parseFloat(amountEth)
  if (amount > 10) {
    warnings.push(`⚠️ Large investment amount: ${amount} ETH`)
    requiresConfirmation = true
  }
  
  // Expiry validation
  if (opportunity.metadata.maturityDate) {
    const expiry = new Date(opportunity.metadata.maturityDate)
    const daysToExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysToExpiry < 30) {
      warnings.push(`⚠️ Position expires in ${Math.ceil(daysToExpiry)} days`)
      requiresConfirmation = true
    }
  }
  
  return {
    canExecute: true,
    warnings,
    requiresConfirmation
  }
}

/**
 * Generate execution command for the opportunity
 */
function generateExecutionCommand(opportunity: UnifiedYieldOpportunity, amountEth: string): string {
  const market = opportunity.metadata.pendleData
  
  // Generate the command that users can copy/paste or the system can suggest
  return `Zap ${amountEth} ETH into ${market.name}`
}

/**
 * Generate detailed execution guidance
 */
function generateExecutionGuidance(
  opportunity: UnifiedYieldOpportunity, 
  amountEth: string,
  warnings: string[]
): {
  command: string
  explanation: string
  riskSummary: string
  expectedOutcome: string
} {
  const market = opportunity.metadata.pendleData
  
  return {
    command: generateExecutionCommand(opportunity, amountEth),
    explanation: `This will use ${amountEth} ETH to enter the ${opportunity.name} position via Pendle's zap-in functionality. The system will automatically handle the ETH → token conversion if needed.`,
    riskSummary: warnings.length > 0 ? warnings.join(' ') : '✅ No major risks detected',
    expectedOutcome: `You'll receive ${opportunity.name} tokens yielding ${opportunity.apy.toFixed(2)}% APY until ${new Date(opportunity.metadata.maturityDate).toLocaleDateString()}`
  }
}

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
      return `Use "Zap X ETH into ${opportunity.name}" to enter this position.`
    default:
      return 'Execution method to be determined.'
  }
}

/**
 * Get next steps recommendations
 */
function getNextSteps(opportunities: UnifiedYieldOpportunity[], hasExecution: boolean = false): string[] {
  const steps: string[] = []
  
  if (opportunities.length > 0) {
    const topOpp = opportunities[0]
    steps.push(`💡 Best opportunity: ${topOpp.name} at ${topOpp.apy.toFixed(2)}% APY`)
    
    if (!hasExecution) {
      if (topOpp.protocol === 'pendle') {
        steps.push(`📝 To invest: Say "Invest 1 ETH in the best opportunity" or "Zap 0.5 ETH into ${topOpp.symbol}"`)
      }
      
      if (opportunities.length > 1) {
        steps.push(`🔄 Compare: Review other opportunities and their risk levels before deciding`)
      }
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
  description: 'Find and analyze the highest yielding Pendle opportunities, with smart execution guidance for ETH investments. Can discover opportunities or provide detailed execution plans.',
  parameters: z.object({
    action: z.enum(['discover', 'analyze', 'execute']).default('discover')
      .describe('Action: "discover" to find opportunities, "analyze" for portfolio analysis, "execute" to get execution guidance'),
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
      .describe('Maximum number of opportunities to return (default: 10)'),
    // Execution guidance parameters
    executeAmount: z.string().optional()
      .describe('Amount of ETH to invest (e.g., "1", "0.5", "2"). Required for execute action.'),
    targetOpportunity: z.string().optional()
      .describe('Specific opportunity to target (e.g., "best", "highest", "PT rswETH"). Defaults to "best".'),
    skipConfirmation: z.boolean().default(false)
      .describe('Skip safety confirmations for risky investments. Use with caution.')
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
        maxResults,
        executeAmount,
        targetOpportunity = 'best',
        skipConfirmation
      } = params

      console.log(`🎯 yield_maximization: Starting Pendle ${action}...`)

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

      // Validate execution parameters
      if (action === 'execute') {
        if (!executeAmount) {
          return {
            _uiDisplayTool: true,
            success: false,
            error: 'executeAmount is required for execute action. Specify ETH amount like "1" or "0.5".'
          }
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

      // Handle execution action (generate guidance)
      if (action === 'execute') {
        try {
          // Parse ETH amount
          const { amountEth, isValid } = parseEthAmount(executeAmount!)
          
          if (!isValid) {
            return {
              _uiDisplayTool: true,
              success: false,
              error: `Invalid ETH amount: ${executeAmount}. Please specify a valid number like "1" or "0.5".`
            }
          }
          
          // Select target opportunity
          let selectedOpportunity: UnifiedYieldOpportunity
          if (targetOpportunity === 'best' || targetOpportunity === 'highest') {
            selectedOpportunity = limitedOpportunities[0] // Best opportunity (already sorted)
          } else {
            // Find by name/symbol
            const found = limitedOpportunities.find(opp => 
              opp.name.toLowerCase().includes(targetOpportunity.toLowerCase()) ||
              opp.symbol.toLowerCase().includes(targetOpportunity.toLowerCase())
            )
            if (!found) {
              return {
                _uiDisplayTool: true,
                success: false,
                error: `Opportunity "${targetOpportunity}" not found in current results. Available: ${limitedOpportunities.map(o => o.symbol).join(', ')}`
              }
            }
            selectedOpportunity = found
          }
          
          // Validate execution safety
          const validation = validateExecution(selectedOpportunity, amountEth)
          
          if (validation.requiresConfirmation && !skipConfirmation) {
            return {
              _uiDisplayTool: true,
              success: false,
              requiresConfirmation: true,
              data: {
                selectedOpportunity: {
                  id: selectedOpportunity.id,
                  name: selectedOpportunity.name,
                  apy: selectedOpportunity.apy,
                  riskLevel: selectedOpportunity.riskLevel,
                  tvl: selectedOpportunity.tvl,
                  maturityDate: selectedOpportunity.metadata.maturityDate
                },
                investmentAmount: amountEth,
                warnings: validation.warnings,
                confirmationMessage: `Please confirm: Invest ${amountEth} ETH in ${selectedOpportunity.name} (${selectedOpportunity.apy.toFixed(2)}% APY, ${selectedOpportunity.riskLevel} risk)`
              },
              message: `Investment requires confirmation due to ${validation.warnings.length} warning(s). Add "skipConfirmation: true" to proceed or say the exact command below.`
            }
          }
          
          // Generate execution guidance
          const guidance = generateExecutionGuidance(selectedOpportunity, amountEth, validation.warnings)
          
          return {
            _uiDisplayTool: true,
            success: true,
            summary: `📋 Ready to invest ${amountEth} ETH in ${selectedOpportunity.name} (${selectedOpportunity.apy.toFixed(2)}% APY)`,
            data: {
              action: 'execute',
              selectedOpportunity: {
                id: selectedOpportunity.id,
                name: selectedOpportunity.name,
                symbol: selectedOpportunity.symbol,
                apy: selectedOpportunity.apy,
                riskLevel: selectedOpportunity.riskLevel,
                tvl: selectedOpportunity.tvl,
                category: selectedOpportunity.category,
                maturityDate: selectedOpportunity.metadata.maturityDate
              },
              investmentAmount: amountEth,
              executionGuidance: guidance,
              nextCommand: guidance.command,
              alternativeCommands: [
                `Zap ${amountEth} ETH into ${selectedOpportunity.symbol}`,
                `Invest ${amountEth} ETH in ${selectedOpportunity.name}`
              ],
              warnings: validation.warnings,
              // Show context opportunities
              topOpportunities: limitedOpportunities.slice(0, 3).map(opp => ({
                name: opp.name,
                apy: opp.apy,
                riskLevel: opp.riskLevel
              })),
              statistics: stats
            }
          }
          
        } catch (error) {
          return {
            _uiDisplayTool: true,
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate execution guidance'
          }
        }
      }

      // Handle discovery/analyze actions (existing logic)
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
    calculateOpportunityStats, generateExecutionCommand,
    generateExecutionGuidance, getExecutionHint,
    getNextSteps,
    getPortfolioRecommendation,
    parseEthAmount,
    validateExecution
}


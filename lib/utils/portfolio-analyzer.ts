import { getTokenUsdPriceBatch } from '../enso/get-token-usd-price'
import { TokenData } from '../types/wallet-token'
import { getWalletBalances } from './wallet'
import { getYieldAggregator, UnifiedYieldOpportunity } from './yield-aggregator'

export interface PortfolioPosition {
  tokenName: string
  tokenSymbol: string
  tokenAddress: string
  balance: number
  balanceUsd: number
  network: string
  currentYield: number  // Current yield if in yield position, 0 otherwise
  isYieldPosition: boolean
  pendleMarketInfo?: {
    marketAddress: string
    expiryDate: string
    underlyingToken: string
  }
}

export interface YieldGapAnalysis {
  position: PortfolioPosition
  bestOpportunity: UnifiedYieldOpportunity | null
  yieldGap: number  // Difference between current yield and best available
  potentialAnnualGain: number  // USD gain if moved to best opportunity
  recommendation: 'hold' | 'optimize' | 'diversify'
  reason: string
}

export interface PortfolioHealthScore {
  overallScore: number  // 0-100, 100 being perfectly optimized
  yieldEfficiency: number  // 0-100, how well yield opportunities are utilized
  riskBalance: number  // 0-100, how well portfolio is risk-balanced
  diversification: number  // 0-100, how well diversified across opportunities
  totalYield: number  // Portfolio-weighted average yield
  missedOpportunityValue: number  // Annual USD value of missed yield
}

export interface RebalancingStrategy {
  name: string
  description: string
  riskLevel: 'conservative' | 'moderate' | 'aggressive'
  targetAllocations: {
    opportunityId: string
    opportunityName: string
    targetPercentage: number
    targetUsdAmount: number
    currentAmount: number
    requiredAction: 'buy' | 'sell' | 'hold'
    requiredUsdAmount: number
  }[]
  expectedYieldImprovement: number
  estimatedAnnualGain: number
  executionSteps: {
    stepNumber: number
    action: string
    description: string
    estimatedGasCost: number
  }[]
}

export interface PortfolioAnalysisResult {
  totalPortfolioValueUsd: number
  positions: PortfolioPosition[]
  yieldGaps: YieldGapAnalysis[]
  healthScore: PortfolioHealthScore
  topOpportunities: UnifiedYieldOpportunity[]
  recommendedStrategies: RebalancingStrategy[]
  summary: {
    currentAvgYield: number
    optimalAvgYield: number
    improvementPotential: number
    totalMissedAnnualValue: number
  }
}

/**
 * Analyzes user's current portfolio and compares with available yield opportunities
 */
export class PortfolioAnalyzer {
  
  /**
   * Perform comprehensive portfolio analysis
   */
  async analyzePortfolio(
    walletAddress: string,
    chainId: number,
    isDemo: boolean,
    riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): Promise<PortfolioAnalysisResult> {
    console.log('🔍 Starting comprehensive portfolio analysis...')
    
    // Fetch current holdings
    const balances = await getWalletBalances(walletAddress, undefined, chainId)
    
    // Filter to only include Ethereum tokens (mainnet or demo)
    const evmTokens = balances.tokens.filter(token => 
      token.network !== 'Solana' && 
      (token.network === 'Ethereum' || token.network === 'Demo') &&
      parseFloat(token.balance) > 0.001
    )
    
    console.log(`📊 Found ${evmTokens.length} Ethereum tokens in portfolio`)
    
    // Calculate USD values for positions
    const positions = await this.buildPortfolioPositions(evmTokens, chainId, isDemo)
    
    // For yield opportunities, always use Ethereum mainnet chainId (1) unless explicitly demo
    const yieldChainId = isDemo ? chainId : 1
    
    // Fetch available yield opportunities
    const aggregator = getYieldAggregator()
    const opportunities = await aggregator.getYieldOpportunities({
      riskLevel: 'aggressive', // Get all opportunities for analysis
      chainId: yieldChainId,
      isDemo
    })
    
    console.log(`🎯 Found ${opportunities.length} Pendle opportunities for analysis`)
    
    // Analyze yield gaps
    const yieldGaps = await this.analyzeYieldGaps(positions, opportunities)
    
    // Calculate portfolio health score
    const healthScore = this.calculateHealthScore(positions, opportunities, yieldGaps)
    
    // Generate rebalancing strategies
    const strategies = this.generateRebalancingStrategies(
      positions, 
      opportunities, 
      yieldGaps, 
      riskTolerance
    )
    
    // Calculate summary metrics
    const totalPortfolioValueUsd = positions.reduce((sum, pos) => sum + pos.balanceUsd, 0)
    const currentAvgYield = this.calculateWeightedAverageYield(positions)
    const optimalAvgYield = this.calculateOptimalYield(positions, opportunities)
    
    return {
      totalPortfolioValueUsd,
      positions,
      yieldGaps,
      healthScore,
      topOpportunities: opportunities.slice(0, 5), // Always include top 5 opportunities
      recommendedStrategies: strategies,
      summary: {
        currentAvgYield,
        optimalAvgYield,
        improvementPotential: optimalAvgYield - currentAvgYield,
        totalMissedAnnualValue: healthScore.missedOpportunityValue
      }
    }
  }
  
  /**
   * Build detailed portfolio positions from raw token data
   */
  private async buildPortfolioPositions(
    tokens: TokenData[], 
    chainId: number, 
    isDemo: boolean
  ): Promise<PortfolioPosition[]> {
    console.log('💰 Building portfolio positions...')
    
    // Get USD prices for all tokens
    const tokenAddresses = tokens.map(token => token.address)
    const pricesArray = await getTokenUsdPriceBatch(tokenAddresses, chainId)
    
    // Create price mapping by address
    const tokenPrices: Record<string, number> = {}
    pricesArray.forEach((price, index) => {
      const token = tokens[index]
      if (token && price && price.price) {
        tokenPrices[token.address] = price.price
      }
    })
    
    const positions: PortfolioPosition[] = []
    
    for (const token of tokens) {
      const balance = parseFloat(token.balance)
      const price = tokenPrices[token.address] || 0
      const balanceUsd = balance * price
      
      // Check if this is a yield-generating position (e.g., Pendle PT/YT)
      const yieldInfo = await this.detectYieldPosition(token, chainId, isDemo)
      
      positions.push({
        tokenName: token.name,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        balance,
        balanceUsd,
        network: token.network,
        currentYield: yieldInfo.currentYield,
        isYieldPosition: yieldInfo.isYieldPosition,
        pendleMarketInfo: yieldInfo.pendleMarketInfo
      })
    }
    
    // Sort by USD value descending
    return positions.sort((a, b) => b.balanceUsd - a.balanceUsd)
  }
  
  /**
   * Detect if a token is currently in a yield-generating position
   */
  private async detectYieldPosition(
    token: TokenData, 
    chainId: number, 
    isDemo: boolean
  ): Promise<{
    currentYield: number
    isYieldPosition: boolean
    pendleMarketInfo?: any
  }> {
    // For now, assume non-yield positions (ETH, USDC, etc.)
    // TODO: Add logic to detect Pendle PT/YT positions and their current yields
    
    // Check if token is a Pendle PT or YT token by symbol patterns
    const isPendleToken = token.symbol.includes('PT-') || token.symbol.includes('YT-')
    
    if (isPendleToken) {
      // TODO: Fetch actual yield rate from Pendle markets
      // For now, return estimated yield
      return {
        currentYield: 8.5, // Placeholder yield
        isYieldPosition: true,
        pendleMarketInfo: {
          marketAddress: 'placeholder',
          expiryDate: '2024-12-31',
          underlyingToken: token.symbol.split('-')[1] || 'unknown'
        }
      }
    }
    
    return {
      currentYield: 0,
      isYieldPosition: false
    }
  }
  
  /**
   * Analyze yield gaps between current positions and best opportunities
   */
  private async analyzeYieldGaps(
    positions: PortfolioPosition[],
    opportunities: UnifiedYieldOpportunity[]
  ): Promise<YieldGapAnalysis[]> {
    console.log('📊 Analyzing yield gaps...')
    
    const analyses: YieldGapAnalysis[] = []
    
    for (const position of positions) {
      // Find the best opportunity for this position's underlying asset
      const bestOpportunity = this.findBestOpportunityForPosition(position, opportunities)
      
      const yieldGap = bestOpportunity 
        ? bestOpportunity.apy - position.currentYield
        : 0
      
      const potentialAnnualGain = bestOpportunity
        ? (position.balanceUsd * yieldGap) / 100
        : 0
      
      // Determine recommendation
      let recommendation: 'hold' | 'optimize' | 'diversify'
      let reason: string
      
      if (yieldGap < 2) {
        recommendation = 'hold'
        reason = 'Current position is already well-optimized'
      } else if (yieldGap < 8) {
        recommendation = 'optimize'
        reason = `Can improve yield by ${yieldGap.toFixed(1)}% APY`
      } else {
        recommendation = 'optimize'
        reason = `Significant yield opportunity: +${yieldGap.toFixed(1)}% APY`
      }
      
      // Consider diversification for large positions
      if (position.balanceUsd > 10000 && !position.isYieldPosition) {
        recommendation = 'diversify'
        reason = 'Large position should be diversified across multiple yield opportunities'
      }
      
      analyses.push({
        position,
        bestOpportunity,
        yieldGap,
        potentialAnnualGain,
        recommendation,
        reason
      })
    }
    
    return analyses.sort((a, b) => b.potentialAnnualGain - a.potentialAnnualGain)
  }
  
  /**
   * Find the best yield opportunity for a given position
   */
  private findBestOpportunityForPosition(
    position: PortfolioPosition,
    opportunities: UnifiedYieldOpportunity[]
  ): UnifiedYieldOpportunity | null {
    // For Pendle opportunities, all can accept ETH via zap-in
    // Try to find opportunities that match the position's underlying asset first
    
    const matchingOpportunities = opportunities.filter(opp => 
      opp.symbol.toLowerCase().includes(position.tokenSymbol.toLowerCase()) ||
      opp.name.toLowerCase().includes(position.tokenSymbol.toLowerCase())
    )
    
    if (matchingOpportunities.length > 0) {
      return matchingOpportunities[0] // Return best matching opportunity
    }
    
    // Fallback to best overall opportunity since all Pendle can accept ETH
    return opportunities[0] || null
  }
  
  /**
   * Calculate portfolio health score
   */
  private calculateHealthScore(
    positions: PortfolioPosition[],
    opportunities: UnifiedYieldOpportunity[],
    yieldGaps: YieldGapAnalysis[]
  ): PortfolioHealthScore {
    console.log('🏥 Calculating portfolio health score...')
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.balanceUsd, 0)
    const totalYield = this.calculateWeightedAverageYield(positions)
    const maxPossibleYield = this.calculateOptimalYield(positions, opportunities)
    
    // Yield Efficiency: How close to optimal yield
    const yieldEfficiency = totalValue > 0 
      ? Math.min(100, (totalYield / Math.max(maxPossibleYield, 1)) * 100)
      : 0
    
    // Risk Balance: Assess if portfolio is properly risk-balanced
    const yieldPositions = positions.filter(p => p.isYieldPosition)
    const nonYieldPositions = positions.filter(p => !p.isYieldPosition)
    const yieldPositionValue = yieldPositions.reduce((sum, p) => sum + p.balanceUsd, 0)
    const nonYieldPositionValue = nonYieldPositions.reduce((sum, p) => sum + p.balanceUsd, 0)
    
    const yieldRatio = totalValue > 0 ? yieldPositionValue / totalValue : 0
    const idealYieldRatio = 0.7 // 70% in yield positions is considered optimal
    const riskBalance = Math.max(0, 100 - Math.abs(yieldRatio - idealYieldRatio) * 200)
    
    // Diversification: Check if concentrated in too few positions
    const positionCount = positions.filter(p => p.balanceUsd > totalValue * 0.05).length
    const diversification = Math.min(100, positionCount * 20) // Max score at 5+ positions
    
    // Missed opportunity value
    const missedOpportunityValue = yieldGaps.reduce((sum, gap) => sum + gap.potentialAnnualGain, 0)
    
    // Overall score: weighted average
    const overallScore = Math.round(
      (yieldEfficiency * 0.4) +
      (riskBalance * 0.3) +
      (diversification * 0.3)
    )
    
    return {
      overallScore,
      yieldEfficiency: Math.round(yieldEfficiency),
      riskBalance: Math.round(riskBalance),
      diversification: Math.round(diversification),
      totalYield,
      missedOpportunityValue
    }
  }
  
  /**
   * Calculate weighted average yield of current portfolio
   */
  private calculateWeightedAverageYield(positions: PortfolioPosition[]): number {
    const totalValue = positions.reduce((sum, pos) => sum + pos.balanceUsd, 0)
    
    if (totalValue === 0) return 0
    
    const weightedYield = positions.reduce((sum, pos) => {
      const weight = pos.balanceUsd / totalValue
      return sum + (pos.currentYield * weight)
    }, 0)
    
    return weightedYield
  }
  
  /**
   * Calculate optimal yield if portfolio was perfectly allocated
   */
  private calculateOptimalYield(
    positions: PortfolioPosition[],
    opportunities: UnifiedYieldOpportunity[]
  ): number {
    if (opportunities.length === 0) return 0
    
    // For simplicity, assume we could put everything in the top 3 opportunities
    // weighted by risk (conservative users get more stable opportunities)
    const topOpps = opportunities.slice(0, 3)
    const avgTopYield = topOpps.reduce((sum, opp) => sum + opp.apy, 0) / topOpps.length
    
    return avgTopYield
  }
  
  /**
   * Generate rebalancing strategies based on analysis
   */
  private generateRebalancingStrategies(
    positions: PortfolioPosition[],
    opportunities: UnifiedYieldOpportunity[],
    yieldGaps: YieldGapAnalysis[],
    riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  ): RebalancingStrategy[] {
    console.log('🎯 Generating rebalancing strategies...')
    
    const strategies: RebalancingStrategy[] = []
    const totalValue = positions.reduce((sum, pos) => sum + pos.balanceUsd, 0)
    
    if (totalValue < 100) {
      // Portfolio too small for meaningful rebalancing
      return strategies
    }
    
    // Strategy 1: Yield Maximization
    if (opportunities.length > 0) {
      const yieldMaxStrategy = this.createYieldMaximizationStrategy(
        positions,
        opportunities,
        totalValue,
        riskTolerance
      )
      strategies.push(yieldMaxStrategy)
    }
    
    // Strategy 2: Conservative Diversification
    if (opportunities.length >= 2) {
      const conservativeStrategy = this.createConservativeDiversificationStrategy(
        positions,
        opportunities,
        totalValue
      )
      strategies.push(conservativeStrategy)
    }
    
    // Strategy 3: Aggressive Growth (if user tolerance allows)
    if (riskTolerance === 'aggressive' && opportunities.length >= 1) {
      const aggressiveStrategy = this.createAggressiveGrowthStrategy(
        positions,
        opportunities,
        totalValue
      )
      strategies.push(aggressiveStrategy)
    }
    
    return strategies
  }
  
  /**
   * Create yield maximization strategy
   */
  private createYieldMaximizationStrategy(
    positions: PortfolioPosition[],
    opportunities: UnifiedYieldOpportunity[],
    totalValue: number,
    riskTolerance: string
  ): RebalancingStrategy {
    const topOpp = opportunities[0]
    const expectedYield = topOpp.apy
    const currentYield = this.calculateWeightedAverageYield(positions)
    
    return {
      name: 'Yield Maximization',
      description: `Focus on highest yield opportunity: ${topOpp.name}`,
      riskLevel: riskTolerance as any,
      targetAllocations: [{
        opportunityId: topOpp.id,
        opportunityName: topOpp.name,
        targetPercentage: 100,
        targetUsdAmount: totalValue,
        currentAmount: 0,
        requiredAction: 'buy' as const,
        requiredUsdAmount: totalValue
      }],
      expectedYieldImprovement: expectedYield - currentYield,
      estimatedAnnualGain: totalValue * (expectedYield - currentYield) / 100,
      executionSteps: [
        {
          stepNumber: 1,
          action: `Zap ${(totalValue / 3000).toFixed(2)} ETH into ${topOpp.name}`,
          description: `Convert current holdings to ${topOpp.name} for maximum yield`,
          estimatedGasCost: 50
        }
      ]
    }
  }
  
  /**
   * Create conservative diversification strategy
   */
  private createConservativeDiversificationStrategy(
    positions: PortfolioPosition[],
    opportunities: UnifiedYieldOpportunity[],
    totalValue: number
  ): RebalancingStrategy {
    const stableOpps = opportunities.filter(opp => opp.metadata.isStablecoin)
    const volatileOpps = opportunities.filter(opp => !opp.metadata.isStablecoin)
    
    const stableOpp = stableOpps[0] || opportunities[0]
    const volatileOpp = volatileOpps[0] || opportunities[1] || opportunities[0]
    
    const weightedYield = (stableOpp.apy * 0.6) + (volatileOpp.apy * 0.4)
    const currentYield = this.calculateWeightedAverageYield(positions)
    
    return {
      name: 'Conservative Diversification',
      description: '60% stable yield, 40% volatile yield for balanced risk',
      riskLevel: 'conservative',
      targetAllocations: [
        {
          opportunityId: stableOpp.id,
          opportunityName: stableOpp.name,
          targetPercentage: 60,
          targetUsdAmount: totalValue * 0.6,
          currentAmount: 0,
          requiredAction: 'buy' as const,
          requiredUsdAmount: totalValue * 0.6
        },
        {
          opportunityId: volatileOpp.id,
          opportunityName: volatileOpp.name,
          targetPercentage: 40,
          targetUsdAmount: totalValue * 0.4,
          currentAmount: 0,
          requiredAction: 'buy' as const,
          requiredUsdAmount: totalValue * 0.4
        }
      ],
      expectedYieldImprovement: weightedYield - currentYield,
      estimatedAnnualGain: totalValue * (weightedYield - currentYield) / 100,
      executionSteps: [
        {
          stepNumber: 1,
          action: `Zap ${(totalValue * 0.6 / 3000).toFixed(2)} ETH into ${stableOpp.name}`,
          description: 'Secure stable yield foundation',
          estimatedGasCost: 40
        },
        {
          stepNumber: 2,
          action: `Zap ${(totalValue * 0.4 / 3000).toFixed(2)} ETH into ${volatileOpp.name}`,
          description: 'Add growth component',
          estimatedGasCost: 40
        }
      ]
    }
  }
  
  /**
   * Create aggressive growth strategy
   */
  private createAggressiveGrowthStrategy(
    positions: PortfolioPosition[],
    opportunities: UnifiedYieldOpportunity[],
    totalValue: number
  ): RebalancingStrategy {
    const highYieldOpps = opportunities.filter(opp => opp.apy > 15).slice(0, 2)
    
    if (highYieldOpps.length === 0) {
      return this.createYieldMaximizationStrategy(positions, opportunities, totalValue, 'aggressive')
    }
    
    const weightedYield = highYieldOpps.reduce((sum, opp) => sum + opp.apy, 0) / highYieldOpps.length
    const currentYield = this.calculateWeightedAverageYield(positions)
    
    return {
      name: 'Aggressive Growth',
      description: 'Target highest APY opportunities for maximum returns',
      riskLevel: 'aggressive',
      targetAllocations: highYieldOpps.map((opp, index) => ({
        opportunityId: opp.id,
        opportunityName: opp.name,
        targetPercentage: index === 0 ? 60 : 40,
        targetUsdAmount: totalValue * (index === 0 ? 0.6 : 0.4),
        currentAmount: 0,
        requiredAction: 'buy' as const,
        requiredUsdAmount: totalValue * (index === 0 ? 0.6 : 0.4)
      })),
      expectedYieldImprovement: weightedYield - currentYield,
      estimatedAnnualGain: totalValue * (weightedYield - currentYield) / 100,
      executionSteps: highYieldOpps.map((opp, index) => ({
        stepNumber: index + 1,
        action: `Zap ${(totalValue * (index === 0 ? 0.6 : 0.4) / 3000).toFixed(2)} ETH into ${opp.name}`,
        description: `Enter high-yield position ${index + 1}`,
        estimatedGasCost: 45
      }))
    }
  }
}

/**
 * Get the global portfolio analyzer instance
 */
export function getPortfolioAnalyzer(): PortfolioAnalyzer {
  return new PortfolioAnalyzer()
} 
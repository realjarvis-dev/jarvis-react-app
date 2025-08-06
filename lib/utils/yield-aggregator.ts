import { getPendleMarkets } from '../pendle/api'
import { SimplifiedPendleMarket } from '../types/pendle'

// Common interface for unified yield opportunities
export interface UnifiedYieldOpportunity {
  id: string
  protocol: 'pendle'
  name: string
  symbol: string
  apy: number
  tvl: number
  riskLevel: 'low' | 'medium' | 'high'
  category: string
  chain: string
  entryMethod: 'pendle_zap'
  exitMethod: 'pendle_redeem' | 'pendle_zap_out'
  metadata: {
    // Protocol-specific data
    pendleData: SimplifiedPendleMarket
    // Common fields
    address: string
    expiry: string
    isStablecoin: boolean
    hasImpermanentLoss: boolean
    maturityDate: string
  }
}

export interface YieldAggregatorOptions {
  minApy?: number
  maxApy?: number
  riskLevel?: 'conservative' | 'moderate' | 'aggressive'
  includeStablecoins?: boolean
  excludeStablecoins?: boolean
  minTvl?: number
  chainId: number
  isDemo?: boolean
}

export class YieldAggregator {
  /**
   * Get unified yield opportunities from Pendle protocol
   */
  async getYieldOpportunities(options: YieldAggregatorOptions): Promise<UnifiedYieldOpportunity[]> {
    console.log('🔍 Fetching Pendle yield opportunities...')
    
    try {
      const pendleOpportunities = await this.getPendleOpportunities(options)
      
      // Filter and sort results
      return this.filterAndRankOpportunities(pendleOpportunities, options)
    } catch (error) {
      console.error('Failed to fetch Pendle opportunities:', error)
      return []
    }
  }

  /**
   * Get Pendle yield opportunities
   */
  private async getPendleOpportunities(options: YieldAggregatorOptions): Promise<UnifiedYieldOpportunity[]> {
    const markets = await getPendleMarkets('active', options.chainId)
    const minApy = options.minApy || 0
    const maxApy = options.maxApy || 200

    return markets
      .filter(market => {
        const apy = market.impliedApy * 100 // Convert to percentage
        return apy >= minApy && apy <= maxApy && market.liquidity >= (options.minTvl || 100000)
      })
      .map(market => {
        const apy = market.impliedApy * 100
        const isStablecoin = this.isStablecoin(market.name)

        // Filter by stablecoin preference
        if (options.includeStablecoins === true && !isStablecoin) return null
        if (options.excludeStablecoins === true && isStablecoin) return null

        return {
          id: `pendle-${market.address}`,
          protocol: 'pendle' as const,
          name: market.name,
          symbol: market.name.split(' ')[0] || market.name,
          apy,
          tvl: market.liquidity,
          riskLevel: this.calculateRiskLevel(apy, 'pendle', isStablecoin),
          category: 'Yield Tokenization',
          chain: this.getChainName(options.chainId),
          entryMethod: 'pendle_zap' as const,
          exitMethod: this.getPendleExitMethod(market),
          metadata: {
            pendleData: market,
            address: market.address,
            expiry: market.expiry,
            isStablecoin,
            hasImpermanentLoss: false, // Pendle PT/YT don't have IL risk
            maturityDate: market.expiry
          }
        }
      })
      .filter(Boolean) as UnifiedYieldOpportunity[]
  }

  /**
   * Filter and rank opportunities based on options
   */
  private filterAndRankOpportunities(
    opportunities: UnifiedYieldOpportunity[], 
    options: YieldAggregatorOptions
  ): UnifiedYieldOpportunity[] {
    let filtered = opportunities

    // Apply risk level filtering
    if (options.riskLevel) {
      const allowedRisks = this.getAllowedRiskLevels(options.riskLevel)
      filtered = filtered.filter(opp => allowedRisks.includes(opp.riskLevel))
    }

    // Sort by risk-adjusted return
    return filtered.sort((a, b) => {
      // Calculate risk-adjusted score
      const scoreA = this.calculateRiskAdjustedScore(a)
      const scoreB = this.calculateRiskAdjustedScore(b)
      return scoreB - scoreA
    })
  }

  /**
   * Calculate risk-adjusted score for ranking
   */
  private calculateRiskAdjustedScore(opportunity: UnifiedYieldOpportunity): number {
    let score = opportunity.apy

    // Apply risk penalty
    const riskPenalty = {
      'low': 0,
      'medium': 0.15,
      'high': 0.3
    }[opportunity.riskLevel]

    score *= (1 - riskPenalty)

    // Boost for higher TVL (indicates more trust/liquidity)
    if (opportunity.tvl > 10000000) score *= 1.1 // 10M+ TVL
    else if (opportunity.tvl > 1000000) score *= 1.05 // 1M+ TVL

    // Boost for stablecoins (lower risk)
    if (opportunity.metadata.isStablecoin) score *= 1.05
    
    return score
  }

  /**
   * Helper methods
   */
  private isStablecoin(name: string): boolean {
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'sUSDe', 'USDe', 'FDUSD']
    return stablecoins.some(stable => name.toUpperCase().includes(stable))
  }

  private calculateRiskLevel(apy: number, protocol: string, isStablecoin: boolean): 'low' | 'medium' | 'high' {
    // Pendle-specific risk assessment
    if (isStablecoin && apy < 15) return 'low'
    if (apy < 20) return 'low'      // Most Pendle opportunities are relatively safe
    if (apy < 40) return 'medium'   // Higher APY might indicate more volatile underlying
    return 'high'                   // Very high APY could be risky or expiring soon
  }

  private getAllowedRiskLevels(riskLevel: 'conservative' | 'moderate' | 'aggressive'): ('low' | 'medium' | 'high')[] {
    switch (riskLevel) {
      case 'conservative': return ['low']
      case 'moderate': return ['low', 'medium']
      case 'aggressive': return ['low', 'medium', 'high']
    }
  }

  private getChainName(chainId: number): string {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      137: 'Polygon',
      42161: 'Arbitrum',
      8453: 'Base',
      10: 'Optimism',
      56: 'BSC'
    }
    return chains[chainId] || 'Unknown'
  }

  private getPendleExitMethod(market: SimplifiedPendleMarket): 'pendle_redeem' | 'pendle_zap_out' {
    // If market is near expiry (within 30 days), use redeem
    const expiry = new Date(market.expiry)
    const now = new Date()
    const daysToExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    
    return daysToExpiry < 30 ? 'pendle_redeem' : 'pendle_zap_out'
  }
}

// Singleton instance
let yieldAggregator: YieldAggregator | null = null

export function getYieldAggregator(): YieldAggregator {
  if (!yieldAggregator) {
    yieldAggregator = new YieldAggregator()
  }
  return yieldAggregator
} 
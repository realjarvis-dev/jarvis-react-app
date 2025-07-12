import { getEnsoClient } from './client'
import { getSimulationService } from './simulation'
import {
  EnsoStrategy,
  EnsoRouteParams,
  EnsoBundleAction,
  EnsoBundleParams,
  EnsoSimulationResult
} from './types'

export class EnsoStrategyBuilder {
  private ensoClient = getEnsoClient()
  private simulationService = getSimulationService()

  /**
   * Build a yield maximization strategy
   */
  async buildYieldMaximizerStrategy(
    userAddress: string,
    tokenAddress: string,
    amount: string,
    chainId: number,
    riskLevel: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): Promise<EnsoStrategy> {
    try {
      // Step 1: Find best yield opportunities
      const minAPY = riskLevel === 'conservative' ? 3 : riskLevel === 'moderate' ? 5 : 8
      const opportunities = await this.ensoClient.getTokens({
        chainId,
        type: 'defi',
        apyFrom: minAPY,
        includeMetadata: true
      })

      if (!opportunities.data.length) {
        throw new Error('No yield opportunities found')
      }

      // Get best opportunity
      const bestOpportunity = opportunities.data
        .filter(token => token.apy && token.apy > 0)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0))[0]

      // Step 2: Get route to best opportunity
      const routeData = await this.ensoClient.getRoute({
        fromAddress: userAddress,
        receiver: userAddress,
        spender: userAddress,
        chainId,
        tokenIn: [tokenAddress],
        tokenOut: [bestOpportunity.address],
        amountIn: [amount],
        routingStrategy: 'router',
        slippage: '100' // 1%
      })

      // Step 3: Create strategy object
      const strategy: EnsoStrategy = {
        id: `yield-maximizer-${Date.now()}`,
        name: 'Yield Maximizer',
        description: `Route ${amount} tokens to the highest yielding opportunity: ${bestOpportunity.symbol} (${bestOpportunity.apy?.toFixed(2)}% APY)`,
        category: 'yield',
        riskLevel: riskLevel === 'conservative' ? 'low' : riskLevel === 'moderate' ? 'medium' : 'high',
        expectedAPY: bestOpportunity.apy?.toFixed(2) + '%',
        inputs: [{
          token: tokenAddress,
          amount,
          symbol: 'TOKEN' // Would need to fetch token info
        }],
        outputs: [{
          token: bestOpportunity.address,
          symbol: bestOpportunity.symbol,
          protocol: bestOpportunity.project
        }],
        routeData,
        walletType: 'EOA',
        tags: ['yield', 'defi', 'automated']
      }

      // Step 4: Simulate the strategy
      strategy.simulation = await this.simulationService.simulateTransaction(
        routeData.tx,
        userAddress,
        chainId,
        strategy
      )

      return strategy
    } catch (error) {
      throw new Error(`Failed to build yield maximizer strategy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Build a cross-chain yield hunter strategy
   */
  async buildCrossChainYieldStrategy(
    userAddress: string,
    tokenAddress: string,
    amount: string,
    sourceChainId: number,
    targetChainIds: number[] = [8453, 42161, 137] // Base, Arbitrum, Polygon
  ): Promise<EnsoStrategy> {
    try {
      let bestStrategy: any = null
      let bestAPY = 0

      // Check opportunities on each target chain
      for (const chainId of targetChainIds) {
        try {
          const opportunities = await this.ensoClient.getTokens({
            chainId,
            type: 'defi',
            apyFrom: 3,
            includeMetadata: true
          })

          const chainBest = opportunities.data
            .filter(token => token.apy && token.apy > bestAPY)
            .sort((a, b) => (b.apy || 0) - (a.apy || 0))[0]

          if (chainBest && chainBest.apy! > bestAPY) {
            bestStrategy = {
              opportunity: chainBest,
              chainId
            }
            bestAPY = chainBest.apy!
          }
        } catch (error) {
          console.warn(`Failed to check opportunities on chain ${chainId}:`, error)
        }
      }

      if (!bestStrategy) {
        throw new Error('No better cross-chain opportunities found')
      }

      // Get cross-chain route
      const routeData = await this.ensoClient.getRoute({
        fromAddress: userAddress,
        receiver: userAddress,
        spender: userAddress,
        chainId: sourceChainId,
        destinationChainId: bestStrategy.chainId,
        tokenIn: [tokenAddress],
        tokenOut: [bestStrategy.opportunity.address],
        amountIn: [amount],
        routingStrategy: 'router',
        slippage: '300' // 3% for cross-chain
      })

      const strategy: EnsoStrategy = {
        id: `cross-chain-hunter-${Date.now()}`,
        name: 'Cross-Chain Yield Hunter',
        description: `Bridge to ${this.getChainName(bestStrategy.chainId)} for ${bestStrategy.opportunity.symbol} (${bestStrategy.opportunity.apy?.toFixed(2)}% APY)`,
        category: 'crosschain',
        riskLevel: 'medium',
        expectedAPY: bestStrategy.opportunity.apy?.toFixed(2) + '%',
        inputs: [{
          token: tokenAddress,
          amount,
          symbol: 'TOKEN'
        }],
        outputs: [{
          token: bestStrategy.opportunity.address,
          symbol: bestStrategy.opportunity.symbol,
          protocol: bestStrategy.opportunity.project
        }],
        routeData,
        walletType: 'EOA',
        tags: ['crosschain', 'yield', 'bridge']
      }

      strategy.simulation = await this.simulationService.simulateTransaction(
        routeData.tx,
        userAddress,
        sourceChainId,
        strategy
      )

      return strategy
    } catch (error) {
      throw new Error(`Failed to build cross-chain strategy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Build LP position entry strategy
   */
  async buildLPStrategy(
    userAddress: string,
    tokenAddress: string,
    amount: string,
    chainId: number,
    preferredProtocol?: string
  ): Promise<EnsoStrategy> {
    try {
      // Find LP opportunities
      const lpTokens = await this.ensoClient.getTokens({
        chainId,
        type: 'defi',
        apyFrom: 5,
        includeMetadata: true
      })

      const lpOpportunities = lpTokens.data.filter(token => 
        token.symbol.includes('LP') || 
        token.symbol.includes('-') ||
        (preferredProtocol && token.project?.toLowerCase().includes(preferredProtocol.toLowerCase()))
      )

      if (!lpOpportunities.length) {
        throw new Error('No LP opportunities found')
      }

      const bestLP = lpOpportunities
        .filter(token => token.apy && token.apy > 0)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0))[0]

      const routeData = await this.ensoClient.getRoute({
        fromAddress: userAddress,
        receiver: userAddress,
        spender: userAddress,
        chainId,
        tokenIn: [tokenAddress],
        tokenOut: [bestLP.address],
        amountIn: [amount],
        routingStrategy: 'router',
        slippage: '200' // 2% for LP positions
      })

      const strategy: EnsoStrategy = {
        id: `lp-strategy-${Date.now()}`,
        name: 'LP Position Builder',
        description: `Enter ${bestLP.symbol} LP position for ${bestLP.apy?.toFixed(2)}% APY`,
        category: 'yield',
        riskLevel: 'medium',
        expectedAPY: bestLP.apy?.toFixed(2) + '%',
        inputs: [{
          token: tokenAddress,
          amount,
          symbol: 'TOKEN'
        }],
        outputs: [{
          token: bestLP.address,
          symbol: bestLP.symbol,
          protocol: bestLP.project
        }],
        routeData,
        walletType: 'EOA',
        tags: ['lp', 'liquidity', 'yield']
      }

      strategy.simulation = await this.simulationService.simulateTransaction(
        routeData.tx,
        userAddress,
        chainId,
        strategy
      )

      return strategy
    } catch (error) {
      throw new Error(`Failed to build LP strategy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Build stablecoin optimization strategy
   */
  async buildStablecoinStrategy(
    userAddress: string,
    stablecoinAddress: string,
    amount: string,
    chainId: number
  ): Promise<EnsoStrategy> {
    try {
      // Find stablecoin yield opportunities
      const stablecoinOpportunities = await this.ensoClient.getTokens({
        chainId,
        type: 'defi',
        underlyingTokens: stablecoinAddress,
        apyFrom: 2,
        includeMetadata: true
      })

      if (!stablecoinOpportunities.data.length) {
        throw new Error('No stablecoin yield opportunities found')
      }

      const bestStablecoinYield = stablecoinOpportunities.data
        .filter(token => token.apy && token.apy > 0)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0))[0]

      const routeData = await this.ensoClient.getRoute({
        fromAddress: userAddress,
        receiver: userAddress,
        spender: userAddress,
        chainId,
        tokenIn: [stablecoinAddress],
        tokenOut: [bestStablecoinYield.address],
        amountIn: [amount],
        routingStrategy: 'router',
        slippage: '50' // 0.5% for stablecoins
      })

      const strategy: EnsoStrategy = {
        id: `stablecoin-optimizer-${Date.now()}`,
        name: 'Stablecoin Yield Optimizer',
        description: `Optimize stablecoin yield with ${bestStablecoinYield.symbol} (${bestStablecoinYield.apy?.toFixed(2)}% APY)`,
        category: 'yield',
        riskLevel: 'low',
        expectedAPY: bestStablecoinYield.apy?.toFixed(2) + '%',
        inputs: [{
          token: stablecoinAddress,
          amount,
          symbol: 'STABLECOIN'
        }],
        outputs: [{
          token: bestStablecoinYield.address,
          symbol: bestStablecoinYield.symbol,
          protocol: bestStablecoinYield.project
        }],
        routeData,
        walletType: 'EOA',
        tags: ['stablecoin', 'yield', 'low-risk']
      }

      strategy.simulation = await this.simulationService.simulateTransaction(
        routeData.tx,
        userAddress,
        chainId,
        strategy
      )

      return strategy
    } catch (error) {
      throw new Error(`Failed to build stablecoin strategy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Simulate a custom strategy
   */
  async simulateStrategy(strategy: EnsoStrategy, userAddress: string): Promise<EnsoSimulationResult> {
    if (!strategy.routeData && !strategy.bundleData) {
      throw new Error('Strategy must have route or bundle data for simulation')
    }

    const transaction = strategy.routeData?.tx || strategy.bundleData?.tx
    if (!transaction) {
      throw new Error('No transaction data found in strategy')
    }

    const chainId = strategy.inputs[0] ? 1 : 1 // Default to mainnet, should be derived from strategy

    return this.simulationService.simulateTransaction(
      transaction,
      userAddress,
      chainId,
      strategy
    )
  }

  private getChainName(chainId: number): string {
    const chainNames: Record<number, string> = {
      1: 'Ethereum',
      8453: 'Base',
      42161: 'Arbitrum',
      137: 'Polygon',
      10: 'Optimism',
      43114: 'Avalanche'
    }
    return chainNames[chainId] || `Chain ${chainId}`
  }
}

// Singleton instance
let strategyBuilder: EnsoStrategyBuilder | null = null

export function getStrategyBuilder(): EnsoStrategyBuilder {
  if (!strategyBuilder) {
    strategyBuilder = new EnsoStrategyBuilder()
  }
  return strategyBuilder
}

export default EnsoStrategyBuilder
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
    riskLevel: 'conservative' | 'moderate' | 'aggressive' = 'moderate',
    isDemo: boolean = false
  ): Promise<EnsoStrategy> {
    try {
      // Step 1: Find best yield opportunities
      const minAPY = riskLevel === 'conservative' ? 3 : riskLevel === 'moderate' ? 5 : 8
      // Cap max APY to avoid illiquid/risky opportunities
      const maxAPY = riskLevel === 'conservative' ? 20 : riskLevel === 'moderate' ? 50 : 200
      
      const opportunities = await this.ensoClient.getTokens({
        chainId,
        type: 'defi',
        apyFrom: minAPY,
        apyTo: maxAPY,
        includeMetadata: true
      })

      console.log(`Found ${opportunities.data.length} yield opportunities on chain ${chainId} (${minAPY}%-${maxAPY}% APY)`)

      if (!opportunities.data.length) {
        throw new Error(`No yield opportunities found on chain ${chainId} with APY between ${minAPY}%-${maxAPY}%`)
      }

      // Filter for more reliable opportunities
      const validOpportunities = opportunities.data
        .filter(token => {
          // Basic validation
          if (!token.apy || !token.address || !token.symbol) return false
          
          // Filter out suspicious tokens
          if (token.apy > maxAPY) return false
          
          // Prefer known protocols
          const preferredProtocols = ['aave', 'compound', 'curve', 'convex', 'lido', 'rocket-pool', 'yearn']
          const isPreferredProtocol = preferredProtocols.some(protocol => 
            token.project?.toLowerCase().includes(protocol.toLowerCase()) ||
            token.protocolSlug?.toLowerCase().includes(protocol.toLowerCase())
          )
          
          // Avoid tokens that look like LP pairs with extremely high APY
          const isLikelyLP = token.symbol.includes('-') || token.symbol.includes('LP') || token.symbol.includes('UNI-V2')
          const hasExtremAPY = token.apy > 100
          
          if (isLikelyLP && hasExtremAPY && !isPreferredProtocol) {
            return false
          }
          
          return true
        })
      
      if (!validOpportunities.length) {
        throw new Error('No reliable yield opportunities found with required criteria')
      }

      const sortedOpportunities = validOpportunities
        .sort((a, b) => {
          // First sort by protocol preference, then by APY
          const aIsPreferred = ['aave', 'compound', 'lido', 'yearn'].some(p => 
            a.project?.toLowerCase().includes(p.toLowerCase())
          )
          const bIsPreferred = ['aave', 'compound', 'lido', 'yearn'].some(p => 
            b.project?.toLowerCase().includes(p.toLowerCase())
          )
          
          if (aIsPreferred && !bIsPreferred) return -1
          if (!aIsPreferred && bIsPreferred) return 1
          
          return (b.apy || 0) - (a.apy || 0)
        })

      console.log('Found opportunities:', sortedOpportunities.slice(0, 3).map(o => ({
        symbol: o.symbol,
        apy: o.apy,
        project: o.project
      })))

      // Step 2: Try to get routes for opportunities (with fallback)
      if (!userAddress || !tokenAddress) {
        throw new Error('Invalid addresses provided for routing')
      }

      // Validate amount is positive
      if (!amount || amount === '0') {
        throw new Error('Invalid amount: must be greater than 0')
      }

      let routeData: any = null
      let selectedOpportunity: any = null

      // Try up to 5 best opportunities until we find one that works
      for (let i = 0; i < Math.min(5, sortedOpportunities.length); i++) {
        const opportunity = sortedOpportunities[i]
        
        try {
          console.log(`Trying route for opportunity ${i + 1}:`, {
            symbol: opportunity.symbol,
            apy: opportunity.apy,
            address: opportunity.address
          })

          // Adjust slippage for demo mode
          const slippage = isDemo ? '3000' : '100' // 30% for demo, 1% for production

          routeData = await this.ensoClient.getRoute({
            fromAddress: userAddress,
            receiver: userAddress,
            spender: userAddress,
            chainId,
            tokenIn: [tokenAddress],
            tokenOut: [opportunity.address],
            amountIn: [amount],
            routingStrategy: 'router',
            slippage
          })

          selectedOpportunity = opportunity
          console.log(`Successfully found route for ${opportunity.symbol}`)
          break

        } catch (routeError) {
          console.warn(`Route failed for ${opportunity.symbol}:`, routeError)
          if (i === sortedOpportunities.length - 1 || i === 4) {
            throw new Error(`Unable to find valid route for any yield opportunities. Last error: ${routeError instanceof Error ? routeError.message : 'Unknown error'}`)
          }
        }
      }

      // If no direct routes work, try an alternative approach with stablecoins
      if (!routeData || !selectedOpportunity) {
        console.log('Direct ETH routing failed, trying stablecoin opportunities...')
        
        // Try stablecoin yield opportunities instead
        const stablecoinOpportunities = await this.ensoClient.getTokens({
          chainId,
          type: 'defi',
          apyFrom: minAPY * 0.5, // Lower threshold for stablecoins
          apyTo: maxAPY * 0.5,
          includeMetadata: true
        })

        const stablecoinValidOpportunities = stablecoinOpportunities.data
          .filter(token => {
            if (!token.apy || !token.address || !token.symbol) return false
            
            // Look for stablecoin-related opportunities
            const stablecoinKeywords = ['USDC', 'USDT', 'DAI', 'FRAX', 'stUSD', 'cUSDC']
            const isStablecoinRelated = stablecoinKeywords.some(keyword => 
              token.symbol.includes(keyword) || 
              token.name?.includes(keyword) ||
              token.underlyingTokens?.some(underlying => 
                typeof underlying === 'string' && underlying.toLowerCase().includes('usdc')
              )
            )
            
            return isStablecoinRelated
          })
          .sort((a, b) => (b.apy || 0) - (a.apy || 0))

        console.log(`Found ${stablecoinValidOpportunities.length} stablecoin opportunities`)

        if (stablecoinValidOpportunities.length > 0) {
          // Try to route ETH -> USDC -> stablecoin yield opportunity
          const bestStablecoinOpp = stablecoinValidOpportunities[0]
          
          try {
            console.log('Trying stablecoin opportunity:', {
              symbol: bestStablecoinOpp.symbol,
              apy: bestStablecoinOpp.apy
            })

            // Use same slippage setting for stablecoin fallback
            const stablecoinSlippage = isDemo ? '3000' : '100' // 30% for demo, 1% for production

            routeData = await this.ensoClient.getRoute({
              fromAddress: userAddress,
              receiver: userAddress,
              spender: userAddress,
              chainId,
              tokenIn: [tokenAddress],
              tokenOut: [bestStablecoinOpp.address],
              amountIn: [amount],
              routingStrategy: 'router',
              slippage: stablecoinSlippage
            })

            selectedOpportunity = bestStablecoinOpp
            console.log(`Successfully found stablecoin route for ${bestStablecoinOpp.symbol}`)
          } catch (stablecoinError) {
            console.warn('Stablecoin routing also failed:', stablecoinError)
          }
        }
      }

      if (!routeData || !selectedOpportunity) {
        throw new Error('Failed to find valid route for any yield opportunities including stablecoin alternatives')
      }

      // Step 3: Create strategy object
      const strategy: EnsoStrategy = {
        id: `yield-maximizer-${Date.now()}`,
        name: 'Yield Maximizer',
        description: `Route ${amount} tokens to the highest yielding opportunity: ${selectedOpportunity.symbol} (${selectedOpportunity.apy?.toFixed(2)}% APY)`,
        category: 'yield',
        riskLevel: riskLevel === 'conservative' ? 'low' : riskLevel === 'moderate' ? 'medium' : 'high',
        expectedAPY: selectedOpportunity.apy?.toFixed(2) + '%',
        inputs: [{
          token: tokenAddress,
          amount,
          symbol: 'TOKEN' // Would need to fetch token info
        }],
        outputs: [{
          token: selectedOpportunity.address,
          symbol: selectedOpportunity.symbol,
          protocol: selectedOpportunity.project
        }],
        routeData,
        walletType: 'EOA',
        tags: ['yield', 'defi', 'automated']
      }

      // Step 4: Simulate the strategy (pass demo mode to simulation)
      strategy.simulation = await this.simulationService.simulateTransaction(
        routeData.tx,
        userAddress,
        chainId,
        strategy,
        isDemo
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
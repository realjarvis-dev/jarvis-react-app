import { tool } from 'ai'
import { z } from 'zod'
import { morphoAPI } from '../morpho/api'
import { getPendleMarkets } from '../pendle/api'
import { getSwapQuote, executePendleSwap } from '../pendle/swap'
import { NetworkContext } from '../types/context'
import { LoopingOpportunity, BorrowingRateData } from '../morpho/types'
import { parseUsdAmount } from '../utils/usd-parser'

/**
 * Quote tool for PT looping opportunities
 */
export const pendlePtLoopingQuoteTool = tool({
  description: 'Find and analyze PT token looping opportunities on Morpho. Shows yield spreads between Pendle PT yields and Morpho borrowing rates for leveraged yield farming.',
  parameters: z.object({
    chainId: z.number().default(1).describe('Chain ID (1 for Ethereum, 8453 for Base)'),
    minYieldSpread: z.number().default(1).describe('Minimum yield spread (PT yield - borrow rate) in percentage'),
    riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate').describe('Risk tolerance for leverage calculations'),
    maxLeverage: z.number().default(4).describe('Maximum leverage multiplier to consider')
  }),
  execute: async (params, context) => {
    try {
      const { chainId, minYieldSpread, riskTolerance, maxLeverage } = params

      // Initialize scanning process
      const scanningProgress = {
        step: 1,
        totalSteps: 4,
        currentAction: 'Fetching Pendle markets...',
        pendleMarketsFound: 0,
        eligiblePTTokens: 0,
        morphoMarketsFound: 0,
        opportunitiesFound: 0
      }

      // Fetch Pendle markets
      const pendleMarkets = await getPendleMarkets('active', chainId)
      scanningProgress.pendleMarketsFound = pendleMarkets.length
      scanningProgress.step = 2
      scanningProgress.currentAction = 'Analyzing PT token eligibility...'
      
      // Get PT token addresses for markets with good liquidity
      const eligiblePTTokens = pendleMarkets
        .filter(market => 
          market.liquidity > 10000 && // Reduced min liquidity to $10k for more opportunities
          market.impliedApy > 0 &&
          new Date(market.expiry) > new Date() // Not expired
        )
        .map(market => {
          const expiryDate = new Date(market.expiry)
          const now = new Date()
          const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          return {
            ptAddress: market.pt,
            impliedApy: market.impliedApy * 100, // Convert decimal to percentage
            name: market.name,
            expiry: market.expiry,
            daysToExpiry,
            liquidity: market.liquidity
          }
        })

      scanningProgress.eligiblePTTokens = eligiblePTTokens.length
      scanningProgress.step = 3
      scanningProgress.currentAction = 'Scanning Morpho markets for PT collateral support...'

      if (eligiblePTTokens.length === 0) {
        return {
          _uiDisplayTool: true,
          summary: 'No eligible PT tokens found for looping',
          data: { 
            opportunities: [], 
            scanningProgress,
            diagnostics: {
              totalPendleMarkets: pendleMarkets.length,
              eligiblePTTokens: 0,
              reason: 'No PT tokens with sufficient liquidity and positive yields found',
              suggestions: [
                'Try lowering the minimum yield spread requirement',
                'Check different chain networks (Base, Arbitrum)',
                'Consider markets with shorter expiry dates'
              ]
            }
          }
        }
      }

      // Fetch Morpho borrowing rates for these PT tokens (filtered by chainId)
      const ptAddresses = eligiblePTTokens.map(pt => pt.ptAddress)
      const borrowingRates = await morphoAPI.getPTTokenBorrowingRates(ptAddresses, [chainId])
      scanningProgress.morphoMarketsFound = borrowingRates.length
      scanningProgress.step = 4
      scanningProgress.currentAction = 'Calculating yield opportunities and optimal leverage...'

      // Find looping opportunities
      const opportunities: LoopingOpportunity[] = []

      for (const ptToken of eligiblePTTokens) {
        const morphoMarket = borrowingRates.find(
          rate => rate.collateralAsset.toLowerCase() === ptToken.ptAddress.toLowerCase()
        )

        if (!morphoMarket) continue

        // Convert Morpho APY from decimal to percentage
        const morphoBorrowApy = morphoMarket.borrowApy * 100
        const yieldSpread = ptToken.impliedApy - morphoBorrowApy
        
        if (yieldSpread < minYieldSpread) continue

        // Calculate optimal leverage
        const optimalLeverage = morphoAPI.calculateOptimalLeverage(
          ptToken.impliedApy / 100, // Convert back to decimal for calculation
          morphoBorrowApy / 100,
          morphoMarket.maxLtv,
          riskTolerance
        )

        if (optimalLeverage <= 1) continue

        // Estimate APYs at different leverage levels
        const estimatedApyAt2x = morphoAPI.estimateAPYAtLeverage(
          ptToken.impliedApy / 100,
          morphoBorrowApy / 100,
          2
        ) * 100
        const estimatedApyAt3x = morphoAPI.estimateAPYAtLeverage(
          ptToken.impliedApy / 100,
          morphoBorrowApy / 100,
          3
        ) * 100
        const estimatedApyAt4x = maxLeverage >= 4 ? morphoAPI.estimateAPYAtLeverage(
          ptToken.impliedApy / 100,
          morphoBorrowApy / 100,
          4
        ) * 100 : 0

        // Determine risk level
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'
        if (optimalLeverage > 3 || yieldSpread < 2) riskLevel = 'HIGH'
        else if (optimalLeverage > 2 || yieldSpread < 3) riskLevel = 'MEDIUM'

        opportunities.push({
          ptToken: ptToken.name,
          ptAddress: ptToken.ptAddress,
          ptExpiry: ptToken.expiry,
          daysToExpiry: ptToken.daysToExpiry,
          ptYield: ptToken.impliedApy,
          morphoMarketKey: morphoMarket.marketKey,
          borrowRate: morphoBorrowApy,
          yieldSpread,
          maxLeverage: Math.min(optimalLeverage, maxLeverage),
          estimatedApyAt2x,
          estimatedApyAt3x,
          estimatedApyAt4x,
          liquidationThreshold: morphoMarket.maxLtv,
          availableLiquidity: morphoMarket.availableLiquidity,
          riskLevel
        })
      }

      // Sort by yield spread (highest first)
      opportunities.sort((a, b) => b.yieldSpread - a.yieldSpread)
      scanningProgress.opportunitiesFound = opportunities.length

      // Collect diagnostic information
      const diagnostics = {
        scanSummary: {
          totalPendleMarkets: scanningProgress.pendleMarketsFound,
          eligiblePTTokens: scanningProgress.eligiblePTTokens,
          morphoMarketsFound: scanningProgress.morphoMarketsFound,
          finalOpportunities: opportunities.length
        },
        sampleData: {
          topPTYields: eligiblePTTokens.slice(0, 5).map(pt => ({ 
            name: pt.name.substring(0, 20) + (pt.name.length > 20 ? '...' : ''), 
            apy: pt.impliedApy.toFixed(2) + '%',
            liquidity: '$' + (pt.liquidity / 1000000).toFixed(1) + 'M'
          })),
          sampleBorrowRates: borrowingRates.slice(0, 3).map(rate => ({
            asset: rate.loanAsset,
            rate: (rate.borrowApy * 100).toFixed(2) + '%'
          }))
        },
        searchCriteria: {
          minYieldSpread: minYieldSpread + '%',
          maxLeverage: maxLeverage + 'x',
          riskTolerance,
          network: chainId === 1 ? 'Ethereum' : chainId === 8453 ? 'Base' : 'Chain ' + chainId
        },
        suggestions: opportunities.length === 0 ? [
          `Try lowering minimum yield spread below ${minYieldSpread}%`,
          'Consider different risk tolerance (conservative/moderate/aggressive)',
          'Check Base network (chainId: 8453) which often has more opportunities',
          'Look for newer PT tokens with higher implied yields'
        ] : []
      }

      const summary = opportunities.length > 0 
        ? `Found ${opportunities.length} PT looping opportunities with yield spreads from ${opportunities[0]?.yieldSpread.toFixed(2)}% to ${opportunities[opportunities.length - 1]?.yieldSpread.toFixed(2)}%`
        : `Scanned ${diagnostics.scanSummary.totalPendleMarkets} Pendle markets and ${diagnostics.scanSummary.morphoMarketsFound} Morpho markets but found no viable looping opportunities`

      return {
        _uiDisplayTool: true,
        summary,
        data: {
          opportunities,
          scanningProgress,
          diagnostics,
          chainId,
          riskTolerance
        }
      }
    } catch (error) {
      console.error('PT looping quote error:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Failed to fetch PT looping opportunities',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
})

/**
 * Execute tool for PT looping strategy
 */
export const pendlePtLoopingExecuteTool = tool({
  description: 'Execute a PT token looping strategy on Morpho. Buy PT tokens, deposit as collateral, borrow USDC, and repeat to create leveraged yield positions.',
  parameters: z.object({
    chainId: z.number().default(1),
    ptTokenAddress: z.string().describe('PT token contract address to loop'),
    morphoMarketKey: z.string().describe('Morpho market unique key for the PT token'),
    initialAmount: z.string().describe('Initial USD amount to start the loop (e.g., "1000" for $1000)'),
    targetLeverage: z.number().min(1.1).max(5).describe('Target leverage multiplier (e.g., 2.5 for 2.5x leverage)'),
    maxSlippage: z.number().default(0.5).describe('Maximum slippage tolerance in percentage'),
    demoMode: z.boolean().default(false).describe('Execute in demo mode (simulated transactions)'),
    userWalletAddress: z.string().describe('User wallet address for execution')
  }),
  execute: async (params, context) => {
    try {
      const { 
        chainId, 
        ptTokenAddress, 
        morphoMarketKey, 
        initialAmount, 
        targetLeverage, 
        maxSlippage,
        demoMode,
        userWalletAddress
      } = params

      if (!userWalletAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet address required',
          data: { error: 'Please provide a wallet address to execute PT looping' }
        }
      }

      // Parse initial amount
      const usdResult = await parseUsdAmount(initialAmount, 'USD', { chainId })
      if (!usdResult.usdAmount || usdResult.usdAmount <= 0) {
        return {
          _uiDisplayTool: true,
          summary: 'Invalid amount specified',
          data: { error: 'Please specify a valid USD amount (e.g., "1000")' }
        }
      }

      // Get market details
      const morphoMarket = await morphoAPI.getMarketByKey(morphoMarketKey)
      if (!morphoMarket) {
        return {
          _uiDisplayTool: true,
          summary: 'Morpho market not found',
          data: { error: 'Could not find the specified Morpho market' }
        }
      }

      // Calculate health factor and safety checks
      const maxLtv = parseFloat(morphoMarket.lltv) / 1e18
      const expectedHealthFactor = morphoAPI.calculateHealthFactor(
        usdResult.usdAmount * targetLeverage,
        usdResult.usdAmount * (targetLeverage - 1),
        maxLtv
      )

      if (expectedHealthFactor < 1.2) {
        return {
          _uiDisplayTool: true,
          summary: 'Leverage too high - liquidation risk',
          data: { 
            error: `Target leverage of ${targetLeverage}x would result in health factor of ${expectedHealthFactor.toFixed(2)}, which is too risky. Maximum safe leverage is approximately ${(maxLtv / 1.2).toFixed(1)}x`,
            maxSafeLeverage: (maxLtv / 1.2).toFixed(1)
          }
        }
      }

      // Calculate loop steps
      const totalCollateralNeeded = usdResult.usdAmount * targetLeverage
      const totalBorrowNeeded = usdResult.usdAmount * (targetLeverage - 1)
      const numberOfLoops = Math.ceil(Math.log(targetLeverage) / Math.log(1 + maxLtv * 0.8)) // Conservative loops

      if (demoMode) {
        return {
          _uiDisplayTool: true,
          summary: `Demo: PT looping strategy planned successfully`,
          data: {
            demoMode: true,
            strategy: {
              ptToken: morphoMarket.collateralAsset.symbol,
              loanAsset: morphoMarket.loanAsset.symbol,
              initialAmount: usdResult.usdAmount,
              targetLeverage,
              totalCollateralValue: totalCollateralNeeded,
              totalBorrowValue: totalBorrowNeeded,
              expectedHealthFactor,
              numberOfLoops,
              estimatedApy: morphoAPI.estimateAPYAtLeverage(
                10, // Placeholder PT yield
                morphoMarket.state.borrowApy,
                targetLeverage
              )
            },
            warning: 'This is a demo. No actual transactions will be executed.'
          }
        }
      }

      // TODO: Implement actual execution logic here
      // This would involve:
      // 1. Approve tokens
      // 2. Execute multiple rounds of: buy PT -> deposit -> borrow -> swap
      // 3. Monitor health factor after each step
      // 4. Handle failures and rollbacks

      return {
        _uiDisplayTool: true,
        summary: 'PT looping execution not yet implemented',
        data: { 
          message: 'Execution logic is still in development. Please use demo mode for now.',
          plannedStrategy: {
            ptToken: morphoMarket.collateralAsset.symbol,
            initialAmount: usdResult.usdAmount,
            targetLeverage,
            expectedHealthFactor
          }
        }
      }
    } catch (error) {
      console.error('PT looping execution error:', error)
      return {
        _uiDisplayTool: true,
        summary: 'PT looping execution failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
})

/**
 * Monitor tool for existing PT looping positions
 */
export const pendlePtLoopingMonitorTool = tool({
  description: 'Monitor existing PT looping positions for health factor, yield performance, and rebalancing opportunities.',
  parameters: z.object({
    chainId: z.number().default(1),
    userAddress: z.string().describe('User address to monitor'),
    alertThreshold: z.number().default(1.5).describe('Health factor threshold for alerts')
  }),
  execute: async (params, context) => {
    try {
      const userAddress = params.userAddress

      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'No user address specified',
          data: { error: 'Please specify a user address' }
        }
      }

      // TODO: Implement position monitoring
      // This would involve:
      // 1. Query Morpho positions for the user
      // 2. Identify PT token collateral positions
      // 3. Calculate current health factors
      // 4. Check for rebalancing opportunities
      // 5. Monitor yield performance vs expectations

      return {
        _uiDisplayTool: true,
        summary: 'Position monitoring not yet implemented',
        data: { 
          message: 'Position monitoring is still in development.',
          userAddress,
          alertThreshold: params.alertThreshold
        }
      }
    } catch (error) {
      console.error('PT looping monitoring error:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Position monitoring failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
})
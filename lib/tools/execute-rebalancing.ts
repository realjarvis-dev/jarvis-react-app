import { tool } from 'ai'
import { z } from 'zod'
import { getTokenBalances } from '../alchemy/get-token-balance'
import { getTokenUsdPriceBatch } from '../enso/get-token-usd-price'
import { executeLifiBridgeTransaction, generateLifiBridgeQuote } from '../lifi/actions'
import { getUserEvmWalletAddress, getUserId } from '../privy/client'
import { balanceChangePub } from '../pubsub/balance-change-pub'
import { getRedisClient } from '../redis/config'
import { ToolContext } from '../types/context'

// Supported tokens for rebalancing
const SUPPORTED_TOKENS = ['ETH', 'USDC', 'stETH'] as const

// Token address mapping
const TOKEN_ADDRESSES: Record<string, string> = {
  'ETH': '0x0000000000000000000000000000000000000000', // Native ETH
  'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on mainnet
  'stETH': '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' // stETH
}

// Minimum drift threshold to trigger rebalancing (5%)
const REBALANCE_THRESHOLD = 5

interface RebalanceAction {
  fromToken: string
  toToken: string
  fromAmount: string
  estimatedToAmount: string
  reason: string
}

export const executeRebalancingTool = tool({
  description: 'Execute portfolio rebalancing to match target allocation by swapping overweight tokens for underweight tokens',
  parameters: z.object({
    dry_run: z.boolean().default(false)
      .describe('If true, only calculate and show what swaps would be executed without actually executing them'),
    slippage: z.number().default(0.005)
      .describe('Slippage tolerance for swaps (default: 0.005 = 0.5%)')
  }),
  execute: async (params, context: ToolContext) => {
    try {
      console.log('⚖️ execute_rebalancing: Starting portfolio rebalancing...')
      
      const { dry_run, slippage } = params
      
      // Get user ID and wallet address
      const userId = await getUserId()
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

      // Only allow on ethereum and demo networks
      if (networkId !== 'ethereum' && networkId !== 'demo') {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Rebalancing is only available on Ethereum and Demo networks.'
        }
      }
      
      // Fetch target allocation from Redis
      const redis = await getRedisClient()
      const allocationKey = `portfolio:target:${userId}`
      
      const allocationData = await redis.hgetall(allocationKey)
      
      if (!allocationData || Object.keys(allocationData).length === 0) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'No target allocation found. Create one first with "Set my target allocation to..."'
        }
      }

      // Parse the target allocation
      const targetAllocation = JSON.parse(allocationData.allocation as string)
      console.log('🎯 Target allocation:', targetAllocation)

      // Get current wallet balances
      console.log('💰 Fetching wallet balances...')
      const tokenBalances = await getTokenBalances(walletAddress, chainId, isDemo)
      
      // Filter only supported tokens
      const relevantTokens = tokenBalances.filter(token => 
        SUPPORTED_TOKENS.includes(token.symbol as any)
      )

      if (relevantTokens.length === 0) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'No supported tokens found in wallet. Supported tokens: ETH, USDC, stETH'
        }
      }

      console.log('🔍 Found relevant tokens:', relevantTokens.map(t => `${t.symbol}: ${t.balance}`))

      // Get token prices
      console.log('💹 Fetching token prices...')
      const tokenAddresses = relevantTokens.map(token => TOKEN_ADDRESSES[token.symbol] || token.address)
      const pricesArray = await getTokenUsdPriceBatch(tokenAddresses, chainId)
      
      // Create price mapping by symbol (same as get_target_allocation)
      const tokenPrices: Record<string, number> = {}
      pricesArray.forEach((price, index) => {
        const token = relevantTokens[index]
        if (token && price) {
          tokenPrices[token.symbol] = price.price
        }
      })
      
      console.log('💰 Token prices:', tokenPrices)

      // Calculate current allocation and drift
      let totalUsdValue = 0
      const tokenValues: Record<string, number> = {}
      
      relevantTokens.forEach(token => {
        const balance = parseFloat(token.balance)
        const price = tokenPrices[token.symbol] || 0
        const value = balance * price
        tokenValues[token.symbol] = value
        totalUsdValue += value
      })

      if (totalUsdValue === 0) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Portfolio has no USD value. Cannot rebalance.'
        }
      }

      // Calculate current allocation percentages and drift
      const actualAllocation: Record<string, number> = {}
      const drift: Record<string, number> = {}
      
      SUPPORTED_TOKENS.forEach(token => {
        const currentValue = tokenValues[token] || 0
        const currentPercentage = (currentValue / totalUsdValue) * 100
        const targetPercentage = targetAllocation[token] || 0
        
        actualAllocation[token] = currentPercentage
        drift[token] = currentPercentage - targetPercentage
      })

      console.log('📊 Current allocation:', actualAllocation)
      console.log('📈 Drift analysis:', drift)

      // Identify tokens that need rebalancing
      const tokensNeedingRebalance = SUPPORTED_TOKENS.filter(token => 
        Math.abs(drift[token]) > REBALANCE_THRESHOLD
      )

      if (tokensNeedingRebalance.length === 0) {
        return {
          _uiDisplayTool: true,
          success: true,
          message: 'Portfolio is already well-balanced. No rebalancing needed.',
          data: {
            totalUsdValue: totalUsdValue.toFixed(2),
            actualAllocation,
            drift,
            rebalanceNeeded: false
          }
        }
      }

      // Calculate rebalance actions
      const rebalanceActions: RebalanceAction[] = []
      
      // Find overweight and underweight tokens
      const overweightTokens = tokensNeedingRebalance.filter(token => drift[token] > REBALANCE_THRESHOLD)
      const underweightTokens = tokensNeedingRebalance.filter(token => drift[token] < -REBALANCE_THRESHOLD)

      console.log('📈 Overweight tokens:', overweightTokens)
      console.log('📉 Underweight tokens:', underweightTokens)

      // Create a copy of drift for planning calculations to avoid modifying original
      const planningDrift = { ...drift }
      
      // Create rebalance actions (sell overweight, buy underweight)
      // Continue until all tokens are balanced or no more beneficial swaps can be made
      let maxIterations = 10 // Prevent infinite loops
      let iterations = 0
      
      while (iterations < maxIterations) {
        iterations++
        let actionCreated = false
        
        // Find current overweight and underweight tokens based on planning drift
        const currentOverweight = overweightTokens.filter(token => 
          planningDrift[token] > REBALANCE_THRESHOLD
        )
        const currentUnderweight = underweightTokens.filter(token => 
          planningDrift[token] < -REBALANCE_THRESHOLD
        )
        
        // If no more imbalances, we're done
        if (currentOverweight.length === 0 || currentUnderweight.length === 0) {
          break
        }
        
        // Process each overweight token
        for (const fromToken of currentOverweight) {
          if (planningDrift[fromToken] <= REBALANCE_THRESHOLD) continue
          
          // Find the most underweight token to pair with
          const sortedUnderweight = currentUnderweight
            .filter(token => planningDrift[token] < -REBALANCE_THRESHOLD)
            .sort((a, b) => planningDrift[a] - planningDrift[b]) // Most negative first
          
          if (sortedUnderweight.length === 0) continue
          
          const toToken = sortedUnderweight[0]
          
          // Calculate how much to swap using planning drift
          const excessPercentage = planningDrift[fromToken]
          const deficitPercentage = Math.abs(planningDrift[toToken])
          
          // Swap the smaller of the two to avoid over-correcting
          const swapPercentage = Math.min(excessPercentage, deficitPercentage)
          const swapUsdValue = (swapPercentage / 100) * totalUsdValue
          
          // Convert USD value to token amount  
          const fromTokenPrice = tokenPrices[fromToken] || 0
          if (fromTokenPrice === 0) continue
          
          const fromAmount = (swapUsdValue / fromTokenPrice).toString()
          
          rebalanceActions.push({
            fromToken,
            toToken,
            fromAmount,
            estimatedToAmount: '0', // Will be filled by quote
            reason: `Reduce ${fromToken} by ${swapPercentage.toFixed(1)}% and increase ${toToken}`
          })
          
          // Update PLANNING drift
          planningDrift[fromToken] -= swapPercentage
          planningDrift[toToken] += swapPercentage
          
          actionCreated = true
          
          console.log(`📊 Created swap: ${fromToken} → ${toToken} (${swapPercentage.toFixed(1)}%)`)
          console.log(`📈 Updated planning drift: ${fromToken}=${planningDrift[fromToken].toFixed(1)}%, ${toToken}=${planningDrift[toToken].toFixed(1)}%`)
        }
        
        // If no actions were created in this iteration, we're done
        if (!actionCreated) {
          break
        }
      }

      if (rebalanceActions.length === 0) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Could not determine rebalancing actions. This may be due to pricing issues.'
        }
      }

      console.log('⚖️ Planned rebalance actions:', rebalanceActions)

      // If dry run, just return the plan
      if (dry_run) {
        return {
          _uiDisplayTool: true,
          success: true,
          message: 'Rebalancing plan calculated (dry run mode)',
          data: {
            totalUsdValue: totalUsdValue.toFixed(2),
            actualAllocation,
            targetAllocation,
            drift,
            rebalanceActions,
            isDryRun: true
          }
        }
      }

      // Execute rebalancing
      const executedActions = []
      const errors = []

      for (const action of rebalanceActions) {
        try {
          console.log(`🔄 Executing swap: ${action.fromAmount} ${action.fromToken} → ${action.toToken}`)
          
          // Get quote first
          const quote = await generateLifiBridgeQuote(
            'ethereum',
            'ethereum', 
            action.fromToken,
            action.toToken,
            walletAddress,
            action.fromAmount,
            slippage.toString(),
            walletAddress,
            false,
            'CHEAPEST'
          )

          // Check if quote was successful (LiFi uses instruction format)
          if (!quote.details || quote.instruction?.includes('notify user') || quote.instruction?.includes('clarify')) {
            const errorMsg = quote.instruction?.includes('notify user') 
              ? (quote.more_details || quote.details || 'Unknown error')
              : 'Failed to get quote'
            errors.push(`Failed to get quote for ${action.fromToken} → ${action.toToken}: ${errorMsg}`)
            continue
          }

          // Extract quote data from details
          const quoteData = quote.details as any

          // Execute the swap
          const execution = await executeLifiBridgeTransaction(
            walletAddress,
            quoteData.fromChainId,
            quoteData.fromToken,
            18, // Assuming 18 decimals for ETH, could be improved
            quoteData.fromTokenAddress,
            quoteData.toChainId,
            quoteData.toToken,
            action.fromAmount,
            slippage.toString(),
            walletAddress,
            quoteData.isFromNativeToken,
            'Ethereum',
            'Ethereum',
            isDemo,
            'CHEAPEST'
          )

          if (execution.success) {
            executedActions.push({
              ...action,
              transactionHash: execution.transaction_hash || 'N/A',
              actualToAmount: quoteData.toAmountToken || '0'
            })
          } else {
            errors.push(`Failed to execute ${action.fromToken} → ${action.toToken}: ${execution.error}`)
          }

        } catch (error) {
          console.error(`Error executing rebalance action:`, error)
          errors.push(`Error swapping ${action.fromToken} → ${action.toToken}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // Emit balance change event
      const balanceChangeNetworkId = networkId === 'demo' ? 'ethereum' : networkId
      balanceChangePub(userId, [balanceChangeNetworkId], isDemo)

      // Re-fetch balances and recalculate allocation after rebalancing
      console.log('🔄 Re-fetching balances after rebalancing...')
      const updatedBalances = await getTokenBalances(walletAddress, chainId)
      
      // Always fetch prices for ALL supported tokens (not just ones with balances)
      const allTokenAddresses = SUPPORTED_TOKENS.map(symbol => TOKEN_ADDRESSES[symbol])
      const updatedPricesArray = await getTokenUsdPriceBatch(allTokenAddresses, chainId)
      
      // Create updated price mapping by symbol for all supported tokens
      const updatedTokenPrices: Record<string, number> = {}
      updatedPricesArray.forEach((price, index) => {
        const tokenSymbol = SUPPORTED_TOKENS[index]
        if (tokenSymbol && price) {
          updatedTokenPrices[tokenSymbol] = price.price
        }
      })

      // Calculate updated allocation for all supported tokens
      let updatedTotalUsdValue = 0
      const updatedTokenValues: Record<string, number> = {}
      
      // Process each supported token (even if balance is 0)
      SUPPORTED_TOKENS.forEach(tokenSymbol => {
        // Find the token in updated balances or default to 0 balance
        const tokenData = updatedBalances.find((token: any) => token.symbol === tokenSymbol)
        const balance = tokenData ? parseFloat(tokenData.balance) : 0
        const price = updatedTokenPrices[tokenSymbol] || 0
        const value = balance * price
        updatedTokenValues[tokenSymbol] = value
        updatedTotalUsdValue += value
      })

      // Calculate updated allocation percentages
      const updatedActualAllocation: Record<string, number> = {}
      const updatedDrift: Record<string, number> = {}
      for (const token of SUPPORTED_TOKENS) {
        const value = updatedTokenValues[token] || 0
        const allocation = updatedTotalUsdValue > 0 ? (value / updatedTotalUsdValue) * 100 : 0
        updatedActualAllocation[token] = allocation
        updatedDrift[token] = allocation - targetAllocation[token]
      }

      console.log('📊 Updated allocation after rebalancing:', updatedActualAllocation)
      console.log('📈 Updated drift after rebalancing:', updatedDrift)

      return {
        _uiDisplayTool: true,
        success: executedActions.length > 0,
        message: executedActions.length > 0 
          ? `Successfully executed ${executedActions.length} rebalancing swap(s)`
          : 'No rebalancing swaps were executed',
        data: {
          totalUsdValue: updatedTotalUsdValue.toFixed(2),
          actualAllocation: updatedActualAllocation,
          targetAllocation,
          drift: updatedDrift,
          executedActions,
          errors: errors.length > 0 ? errors : undefined,
          isDryRun: false
        }
      }

    } catch (error) {
      console.error('Error in execute rebalancing tool:', error)
      return {
        _uiDisplayTool: true,
        success: false,
        error: `Failed to execute rebalancing: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}) 
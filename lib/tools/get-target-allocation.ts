import { tool } from 'ai'
import { z } from 'zod'
import { getTokenBalances } from '../alchemy/get-token-balance'
import { REBALANCE_THRESHOLD } from '../constants'
import { getTokenUsdPriceBatch } from '../enso/get-token-usd-price'
import { getUserEvmWalletAddress, getUserId } from '../privy/client'
import { getRedisClient } from '../redis/config'
import { ToolContext } from '../types/context'

// Supported tokens for allocation analysis
const SUPPORTED_TOKENS = ['ETH', 'USDC'] as const

// Token addresses for supported tokens
const TOKEN_ADDRESSES: Record<string, string> = {
  'ETH': '0x0000000000000000000000000000000000000000', // Native ETH
  'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on demo/mainnet
}

export const getTargetAllocationTool = tool({
  description: 'Get the user\'s saved target portfolio allocation strategy along with current actual allocation and drift analysis',
  parameters: z.object({}),
  execute: async (params, context: ToolContext) => {
    try {
      console.log('🎯 get_target_allocation: Starting analysis...')
      
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

      // Helper function to safely parse JSON fields with type validation
      const safeParseJSON = <T>(field: any, fallback: T): T => {
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch {
            return fallback;
          }
        }
        return field || fallback;
      };

      // Parse the target allocation safely (handles both string and object formats)
      const targetAllocation = safeParseJSON(allocationData.allocation, {} as Record<string, number>)
      const updatedAt = allocationData.updatedAt

      console.log('📊 Target allocation:', targetAllocation)

      // Validate that we have a valid allocation object
      if (!targetAllocation || Object.keys(targetAllocation).length === 0) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Target allocation data is corrupted. Please create a new target allocation.'
        }
      }

      // Get current wallet balances
      console.log('💰 Fetching wallet balances...')
      const tokenBalances = await getTokenBalances(walletAddress, chainId, isDemo)
      
      // Filter only supported tokens and get their addresses for pricing
      const relevantTokens = tokenBalances.filter(token => 
        SUPPORTED_TOKENS.includes(token.symbol as any)
      )

      console.log('🔍 Found relevant tokens:', relevantTokens.map(t => `${t.symbol}: ${t.balance}`))

      // Get token prices
      let tokenPrices: Record<string, number> = {}
      if (relevantTokens.length > 0) {
        console.log('💹 Fetching token prices...')
        try {
          const tokenAddresses = relevantTokens.map(token => {
            // Map symbols to addresses for price fetching
            return TOKEN_ADDRESSES[token.symbol] || token.address
          })
          
          const priceData = await getTokenUsdPriceBatch(tokenAddresses, chainId)
          
          // Create price mapping by symbol
          priceData.forEach((price, index) => {
            const token = relevantTokens[index]
            if (token && price) {
              tokenPrices[token.symbol] = price.price
            }
          })
          
          console.log('💰 Token prices:', tokenPrices)
        } catch (error) {
          console.warn('⚠️ Failed to fetch token prices:', error)
          // Continue without prices - we'll show balances only
        }
      }

      // Calculate actual allocation percentages
      let actualAllocation: Record<string, number> = {}
      let totalUsdValue = 0

      // Calculate USD values for each token
      const tokenUsdValues: Record<string, number> = {}
      
      relevantTokens.forEach(token => {
        const balance = parseFloat(token.balance)
        const price = tokenPrices[token.symbol] || 0
        const usdValue = balance * price
        
        tokenUsdValues[token.symbol] = usdValue
        totalUsdValue += usdValue
      })

      // Calculate percentages
      if (totalUsdValue > 0) {
        Object.keys(targetAllocation).forEach(tokenSymbol => {
          const usdValue = tokenUsdValues[tokenSymbol] || 0
          actualAllocation[tokenSymbol] = (usdValue / totalUsdValue) * 100
        })
      } else {
        // If no USD values, set all to 0
        Object.keys(targetAllocation).forEach(tokenSymbol => {
          actualAllocation[tokenSymbol] = 0
        })
      }

      // Calculate drift (difference between target and actual)
      const drift: Record<string, number> = {}
      Object.keys(targetAllocation).forEach(tokenSymbol => {
        const target = targetAllocation[tokenSymbol] || 0
        const actual = actualAllocation[tokenSymbol] || 0
        drift[tokenSymbol] = actual - target
      })

      console.log('📈 Analysis complete:', {
        totalUsdValue,
        actualAllocation,
        drift
      })

      return {
        _uiDisplayTool: true,
        success: true,
        data: {
          userId,
          targetAllocation,
          actualAllocation,
          drift,
          totalUsdValue,
          tokenBalances: relevantTokens,
          tokenPrices,
          updatedAt,
          analysis: {
            hasSignificantDrift: Object.values(drift).some(d => Math.abs(d) > REBALANCE_THRESHOLD),
            maxDrift: Math.max(...Object.values(drift).map(Math.abs)),
            needsRebalancing: Object.values(drift).some(d => Math.abs(d) > REBALANCE_THRESHOLD)
          }
        },
        summary: `Target vs Actual allocation analysis complete. Total portfolio value: $${totalUsdValue.toFixed(2)}`
      }

    } catch (error) {
      console.error('Error getting target allocation with portfolio analysis:', error)
      
      if (error instanceof Error && error.message.includes('Oops, you are logged out')) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Please log in to view your target allocation'
        }
      }
      
      return {
        _uiDisplayTool: true,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze portfolio allocation'
      }
    }
  }
}) 
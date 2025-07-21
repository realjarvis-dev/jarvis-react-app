import { tool } from 'ai'
import { z } from 'zod'
import { getUserId } from '../privy/client'
import { getRedisClient } from '../redis/config'
import { ToolContext } from '../types/context'

// Supported tokens for Phase 1
const SUPPORTED_TOKENS = ['ETH', 'USDC'] as const

export const createTargetAllocationTool = tool({
  description: 'Create or update a target portfolio allocation strategy. Supports ETH and USDC with percentages that must total 100%. Parse user input like "70% ETH, 30% USDC" into allocation object.',
  parameters: z.object({
    allocation: z.object({
      ETH: z.number().min(0).max(100).optional().describe('Percentage allocation for ETH (0-100)'),
      USDC: z.number().min(0).max(100).optional().describe('Percentage allocation for USDC (0-100)')
    }).refine(
      (data) => Object.keys(data).length > 0,
      { message: "At least one token allocation must be specified" }
    ).describe('Target allocation percentages for supported tokens. Example: {"ETH": 70, "USDC": 30}')
  }),
  execute: async (params, context: ToolContext) => {
    try {
      console.log('🎯 create_target_allocation params:', JSON.stringify(params, null, 2))
      const { allocation } = params

      // Filter out undefined values and validate that percentages add up to 100%
      const definedAllocations = Object.entries(allocation)
        .filter(([_, percentage]) => percentage !== undefined)
        .reduce((acc, [token, percentage]) => ({ ...acc, [token]: percentage }), {} as Record<string, number>)
      
      const totalPercentage = Object.values(definedAllocations).reduce((sum: number, percentage: number) => sum + percentage, 0)
      
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: `Target allocation percentages must add up to 100%. Current total: ${totalPercentage}%`
        }
      }

      // Get user ID for storing allocation
      const userId = await getUserId()
      
      // Create allocation data
      const allocationData = {
        userId,
        allocation: definedAllocations,
        updatedAt: new Date().toISOString()
      }

      // Store in Redis
      const redis = await getRedisClient()
      const allocationKey = `portfolio:target:${userId}`
      
      await redis.hmset(allocationKey, {
        userId,
        allocation: definedAllocations, // Store object directly, Redis wrapper will handle conversion
        updatedAt: allocationData.updatedAt
      })

      console.log(`✅ Target allocation saved for user ${userId}`)

      return {
        _uiDisplayTool: true,
        success: true,
        data: allocationData,
        summary: `Target allocation saved: ${Object.entries(definedAllocations)
          .map(([token, percentage]) => `${percentage}% ${token}`)
          .join(', ')}`
      }

    } catch (error) {
      console.error('Error creating target allocation:', error)
      
      if (error instanceof Error && error.message.includes('Oops, you are logged out')) {
        return {
          _uiDisplayTool: true,
          success: false,
          error: 'Please log in to create a target allocation strategy'
        }
      }
      
      return {
        _uiDisplayTool: true,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create target allocation'
      }
    }
  }
}) 
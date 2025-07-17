import { tool } from 'ai'
import { z } from 'zod'
import { getUserId } from '../privy/client'
import { getRedisClient } from '../redis/config'
import { ToolContext } from '../types/context'

export const getTargetAllocationTool = tool({
  description: 'Get the user\'s saved target portfolio allocation strategy',
  parameters: z.object({}),
  execute: async (params, context: ToolContext) => {
    try {
      // Get user ID
      const userId = await getUserId()
      
      // Fetch from Redis
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

      // Parse the allocation JSON
      const allocation = JSON.parse(allocationData.allocation as string)
      const updatedAt = allocationData.updatedAt

      console.log(`✅ Target allocation retrieved for user ${userId}`)

      return {
        _uiDisplayTool: true,
        success: true,
        data: {
          userId,
          allocation,
          updatedAt
        },
        summary: `Current target allocation: ${Object.entries(allocation)
          .map(([token, percentage]) => `${percentage}% ${token}`)
          .join(', ')}`
      }

    } catch (error) {
      console.error('Error getting target allocation:', error)
      
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
        error: error instanceof Error ? error.message : 'Failed to get target allocation'
      }
    }
  }
}) 
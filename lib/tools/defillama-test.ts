import { tool } from 'ai'
import { z } from 'zod'

export const defiTestTool = tool({
  description: 'Simple test tool for DeFiLlama integration debugging',
  parameters: z.object({
    message: z.string().default('test').describe('Test message')
  }),
  execute: async ({ message }) => {
    console.log('🧪 Test tool executed with message:', message)
    
    // Simulate a simple successful response
    return {
      _uiDisplayTool: true,
      summary: `Test tool executed successfully with message: ${message}`,
      data: {
        message,
        timestamp: new Date().toISOString(),
        status: 'success'
      }
    }
  }
})
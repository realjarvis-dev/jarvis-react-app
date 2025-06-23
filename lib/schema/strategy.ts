import { z } from 'zod'

export const strategyOrchestratorSchema = z.object({
  investment_goal: z.string().describe('User investment objective (e.g., "maximize yield", "minimize risk")'),
  available_capital: z.string().describe('Amount of capital available for the strategy'),
  risk_tolerance: z.enum(['low', 'medium', 'high']).describe('User risk tolerance level'),
  time_horizon: z.enum(['short', 'medium', 'long']).describe('Investment time horizon'),
  preferred_protocols: z.array(z.string()).describe('Preferred DeFi protocols to use (use empty array if no preference)')
})

export const strictStrategyOrchestratorSchema = z.object({
  investment_goal: z.string().describe('User investment objective (e.g., "maximize yield", "minimize risk")'),
  available_capital: z.string().describe('Amount of capital available for the strategy'),
  risk_tolerance: z.enum(['low', 'medium', 'high']).describe('User risk tolerance level'),
  time_horizon: z.enum(['short', 'medium', 'long']).describe('Investment time horizon'),
  preferred_protocols: z.array(z.string()).describe('Preferred DeFi protocols to use (use empty array if no preference)')
})

export function getStrategyOrchestratorSchemaForModel(fullModel: string) {
  console.log('=== SCHEMA SELECTION DEBUG START ===')
  console.log('Debug - getStrategyOrchestratorSchemaForModel called with:', fullModel)
  console.log('Debug - typeof fullModel:', typeof fullModel)
  const [provider, modelName] = fullModel?.split(':') ?? []
  console.log('Debug - provider:', provider, 'modelName:', modelName)
  const useStrictSchema =
    ((provider === 'openai' || provider === 'azure') && modelName?.startsWith('o')) ||
    (provider === 'anthropic' && modelName?.includes('claude-opus-4'))
  console.log('Debug - useStrictSchema:', useStrictSchema)
  
  const selectedSchema = useStrictSchema ? strictStrategyOrchestratorSchema : strategyOrchestratorSchema
  console.log('Debug - selectedSchema instanceof z.ZodObject:', selectedSchema instanceof z.ZodObject)
  console.log('Debug - selectedSchema._def:', selectedSchema._def)
  console.log('Debug - selectedSchema.shape:', selectedSchema.shape)
  console.log('Debug - Object.keys(selectedSchema.shape):', Object.keys(selectedSchema.shape || {}))
  console.log('Debug - strategyOrchestratorSchema.shape:', strategyOrchestratorSchema.shape)
  console.log('Debug - Object.keys(strategyOrchestratorSchema.shape):', Object.keys(strategyOrchestratorSchema.shape || {}))
  console.log('=== SCHEMA SELECTION DEBUG END ===')
  
  return selectedSchema
}

export const strategyExecutorSchema = z.object({
  strategy_plan: z.object({
    steps: z.array(z.object({
      step: z.number(),
      action: z.string(),
      tool: z.string(),
      description: z.string(),
      wait_for_confirmation: z.boolean(),
      parameters: z.record(z.string(), z.string()).optional().describe('Tool parameters (use empty object if none)')
    })),
    execution_order: z.string(),
    max_steps: z.number().describe('Maximum steps allowed (use 15 if not specified)')
  }),
  user_wallet_address: z.string().describe('User wallet address for transactions'),
  execute_immediately: z.boolean().describe('Whether to execute immediately or just validate the plan (use true for immediate execution)')
})

export const strictStrategyExecutorSchema = z.object({
  strategy_plan: z.object({
    steps: z.array(z.object({
      step: z.number(),
      action: z.string(),
      tool: z.string(),
      description: z.string(),
      wait_for_confirmation: z.boolean(),
      parameters: z.record(z.string(), z.string()).describe('Tool parameters (use empty object if none)')
    })),
    execution_order: z.string(),
    max_steps: z.number().describe('Maximum steps allowed (use 15 if not specified)')
  }),
  user_wallet_address: z.string().describe('User wallet address for transactions'),
  execute_immediately: z.boolean().describe('Whether to execute immediately or just validate the plan (use true for immediate execution)')
})

export function getStrategyExecutorSchemaForModel(fullModel: string) {
  const [provider, modelName] = fullModel?.split(':') ?? []
  const useStrictSchema =
    ((provider === 'openai' || provider === 'azure') && modelName?.startsWith('o')) ||
    (provider === 'anthropic' && modelName?.includes('claude-opus-4'))
  
  return useStrictSchema ? strictStrategyExecutorSchema : strategyExecutorSchema
}

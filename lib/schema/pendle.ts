import { z } from 'zod'

const PENDLE_CONFIG = {
  MIN_OPPORTUNITIES: 1,
  MAX_OPPORTUNITIES: 50,
  DEFAULT_OPPORTUNITIES: 10
}

export const pendleOpportunitiesSchema = z.object({
  max_results: z
    .number()
    .min(PENDLE_CONFIG.MIN_OPPORTUNITIES)
    .max(PENDLE_CONFIG.MAX_OPPORTUNITIES)
    .default(PENDLE_CONFIG.DEFAULT_OPPORTUNITIES)
    .describe(`Number of opportunities to return (default ${PENDLE_CONFIG.DEFAULT_OPPORTUNITIES})`),
  apy_gte: z
    .number()
    .default(0)
    .describe(
      'Minimum APY in percentage (e.g., 7 for 7%). Filters for APY >= value/100. Use 0 for no minimum filter.'
    ),
  apy_lte: z
    .number()
    .default(100)
    .describe(
      'Maximum APY in percentage (e.g., 100 for 100%). Filters for APY <= value/100. Use 100 for no maximum filter.'
    )
})

export const strictPendleOpportunitiesSchema = z.object({
  max_results: z
    .number()
    .min(PENDLE_CONFIG.MIN_OPPORTUNITIES)
    .max(PENDLE_CONFIG.MAX_OPPORTUNITIES)
    .describe(`Number of opportunities to return (default ${PENDLE_CONFIG.DEFAULT_OPPORTUNITIES})`),
  apy_gte: z
    .number()
    .describe(
      'Minimum APY in percentage (e.g., 7 for 7%). Filters for APY >= value/100. Use 0 for no minimum filter.'
    ),
  apy_lte: z
    .number()
    .describe(
      'Maximum APY in percentage (e.g., 100 for 100%). Filters for APY <= value/100. Use 100 for no maximum filter.'
    )
})

export function getPendleOpportunitiesSchemaForModel(fullModel: string) {
  const [provider, modelName] = fullModel?.split(':') ?? []
  const useStrictSchema =
    ((provider === 'openai' || provider === 'azure') && modelName?.startsWith('o')) ||
    (provider === 'anthropic' && modelName?.includes('claude-opus-4'))
  
  return useStrictSchema ? strictPendleOpportunitiesSchema : pendleOpportunitiesSchema
}

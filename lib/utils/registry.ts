import { createOpenAI, openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import {
  createProviderRegistry,
  extractReasoningMiddleware,
  wrapLanguageModel
} from 'ai'

export const registry = createProviderRegistry({
  openai,
  // anthropic, // TODO: Uncomment when ready to use Anthropic
  'openai-compatible': createOpenAI({
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: process.env.OPENAI_COMPATIBLE_API_BASE_URL
  })
})

// To enable Anthropic:
// 1. Uncomment the anthropic line above
// 2. Uncomment the anthropic tool call logic in getToolCallModel
// 3. Set ANTHROPIC_API_KEY in your environment

export function getModel(model: string) {
  return registry.languageModel(
    model as Parameters<typeof registry.languageModel>[0]
  )
}

export function isProviderEnabled(providerId: string): boolean {
  switch (providerId) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'openai-compatible':
      return (
        !!process.env.OPENAI_COMPATIBLE_API_KEY &&
        !!process.env.OPENAI_COMPATIBLE_API_BASE_URL
      )
    default:
      return false
  }
}

export function getToolCallModel(model?: string) {
  const [provider, ...modelNameParts] = model?.split(':') ?? []
  
  switch (provider) {
    case 'anthropic':
      // TODO: Uncomment when anthropic is enabled in registry
      // return getModel('anthropic:claude-3-haiku-20240307')
      return getModel('openai:gpt-4o-mini')
    default:
      return getModel('openai:gpt-4o-mini')
  }
}

export function isToolCallSupported(model?: string) {
  const [provider, ...modelNameParts] = model?.split(':') ?? []
  
  switch (provider) {
    case 'openai':
    case 'anthropic':
    case 'openai-compatible':
      return true
    default:
      return true // Default to true for supported providers
  }
}

export function isReasoningModel(model: string): boolean {
  if (typeof model !== 'string') {
    return false
  }
  return model.includes('o3-mini')
}

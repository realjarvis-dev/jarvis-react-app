// Memory-optimized tool registry with lazy loading
export * from './tool-registry-lazy'

// Legacy imports for backward compatibility
import { ChainType } from '@/lib/network/types'
import { z } from 'zod'
import { NetworkContext, ToolContext } from '../types/context'
import { 
  LazyToolRegistry, 
  createLazyToolRegistry, 
  getLazyToolRegistry,
  ToolCategory,
  ToolDefinition,
  ModelCapability 
} from './tool-registry-lazy'

/**
 * Legacy ToolRegistry wrapper for backward compatibility
 * Wraps the new LazyToolRegistry with the old interface
 */
export class ToolRegistry {
  private lazyRegistry: LazyToolRegistry

  constructor(model?: string) {
    this.lazyRegistry = createLazyToolRegistry(model || 'openai:gpt-4o-mini')
  }

  /**
   * Register a tool with the registry
   */
  registerTool(tool: ToolDefinition): void {
    // Convert to lazy loader for compatibility
    this.lazyRegistry.registerToolLoader({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      supportedNetworks: tool.supportedNetworks,
      loader: async () => ({
        schema: tool.schema,
        execute: tool.execute
      })
    })
  }

  /**
   * Get a tool by name
   */
  async getTool(name: string): Promise<ToolDefinition | undefined> {
    return await this.lazyRegistry.getTool(name)
  }

  /**
   * Get all registered tools (WARNING: loads all tools)
   */
  getAllTools(): ToolDefinition[] {
    console.warn('getAllTools() loads all tools - consider using lazy alternatives')
    return this.lazyRegistry.getAllLoadedTools()
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAllTools().filter(tool => tool.category === category)
  }

  /**
   * Get tool names by category
   */
  getToolNamesByCategory(category: ToolCategory): string[] {
    return this.lazyRegistry.getToolNamesByCategory(category)
  }

  /**
   * Get all tool names
   */
  getAllToolNames(): string[] {
    return this.lazyRegistry.getAllToolNames()
  }

  /**
   * Register model capabilities
   */
  registerModelCapability(modelId: string, capability: ModelCapability): void {
    this.lazyRegistry.registerModelCapability(modelId, capability)
  }

  /**
   * Get model capabilities
   */
  getModelCapability(modelId: string): ModelCapability {
    return this.lazyRegistry.getModelCapability(modelId)
  }

  /**
   * Get supported tool names for a model
   */
  getSupportedToolNames(modelId: string): string[] {
    return this.lazyRegistry.getSupportedToolNames(modelId)
  }

  /**
   * Get supported tool names for a model with network filtering
   */
  getSupportedToolNamesForNetwork(
    modelId: string,
    networkContext: NetworkContext
  ): string[] {
    return this.lazyRegistry.getSupportedToolNamesForNetwork(modelId, networkContext)
  }

  /**
   * Get max steps for a model
   */
  getMaxSteps(modelId: string, searchMode: boolean): number {
    return this.lazyRegistry.getMaxSteps(modelId, searchMode)
  }

  /**
   * Get the underlying lazy registry for advanced usage
   */
  getLazyRegistry(): LazyToolRegistry {
    return this.lazyRegistry
  }
}

/**
 * Create and initialize the tool registry using lazy loading
 */
export function createToolRegistry(model: string): ToolRegistry {
  console.log('🚀 Creating lazy-loaded tool registry for memory optimization')
  return new ToolRegistry(model)
}

let toolRegistryInstance: ToolRegistry | null = null

export function getToolRegistry(model: string): ToolRegistry {
  if (!toolRegistryInstance) {
    console.log('📦 Initializing tool registry with lazy loading')
    toolRegistryInstance = createToolRegistry(model)
  }
  return toolRegistryInstance
}

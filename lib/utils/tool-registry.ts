import { z } from 'zod'
import { NetworkConfig } from '../config/network-selection'
import { searchSchema } from '../schema/search'
import { getGasPriceTool } from '../tools/gas-price'
import { genericSwapTool } from '../tools/generic-swap'
import { kodiakDepositTool, kodiakOpportunitiesTool } from '../tools/kodiak'
import { marketChartTool } from '../tools/market-chart'
import { pendleOpportunitiesTool, pendleQuoteTool, pendleSwapTool } from '../tools/pendle'
import { privyTransferTool } from '../tools/privy-transfer'
import { createQuestionTool } from '../tools/question'
import { retrieveTool } from '../tools/retrieve'
import { createSearchTool } from '../tools/search'
import { createVideoSearchTool } from '../tools/video-search'
import { walletBalanceTool } from '../tools/wallet'

interface ToolExecutionOptions {
  toolCallId?: string
  messages?: any[]
}

/**
 * Network context passed to tools
 */
export interface NetworkContext {
  selectedNetwork: 'ethereum' | 'sepolia' | 'berachain' | 'demo'
  selectedChainId: number
  isDemo: boolean
  rpcUrl: string
  config: NetworkConfig
}

/**
 * Interface for tool definition with schema and execution function
 */
export interface ToolDefinition<T = any> {
  name: string
  description: string
  schema: z.ZodType<T>
  execute: (params: T, context?: any, networkContext?: NetworkContext) => Promise<any> | PromiseLike<any>
  category: ToolCategory
  supportedNetworks?: ('ethereum' | 'sepolia' | 'berachain' | 'demo')[]
}

/**
 * Tool categories for organization and filtering
 */
export enum ToolCategory {
  WEB = 'web',
  WEB3 = 'web3',
  UTILITY = 'utility'
}

/**
 * Model capability configuration
 */
export interface ModelCapability {
  supportedCategories: ToolCategory[]
  maxSteps: number
}

/**
 * Tool registry for centralized tool management
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private modelCapabilities: Map<string, ModelCapability> = new Map()

  constructor() {
    this.modelCapabilities.set('default', {
      supportedCategories: [ToolCategory.WEB, ToolCategory.WEB3, ToolCategory.UTILITY],
      maxSteps: 10
    })
    
    this.modelCapabilities.set('openai:o3-mini', {
      supportedCategories: [ToolCategory.WEB, ToolCategory.UTILITY],
      maxSteps: 5
    })
  }

  /**
   * Register a tool with the registry
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
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
    return this.getToolsByCategory(category).map(tool => tool.name)
  }

  /**
   * Get all tool names
   */
  getAllToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Register model capabilities
   */
  registerModelCapability(modelId: string, capability: ModelCapability): void {
    this.modelCapabilities.set(modelId, capability)
  }

  /**
   * Get model capabilities
   */
  getModelCapability(modelId: string): ModelCapability {
    return this.modelCapabilities.get(modelId) || this.modelCapabilities.get('default')!
  }

  /**
   * Get supported tool names for a model
   */
  getSupportedToolNames(modelId: string): string[] {
    const capability = this.getModelCapability(modelId)
    return this.getAllTools()
      .filter(tool => capability.supportedCategories.includes(tool.category))
      .map(tool => tool.name)
  }

  /**
   * Get supported tool names for a model with network filtering
   */
  getSupportedToolNamesForNetwork(modelId: string, networkContext: NetworkContext): string[] {
    const capability = this.getModelCapability(modelId)
    return this.getAllTools()
      .filter(tool => capability.supportedCategories.includes(tool.category))
      .filter(tool => {
        // If tool doesn't specify supported networks, it supports all networks
        if (!tool.supportedNetworks) return true
        // Otherwise, check if current network is supported
        return tool.supportedNetworks.includes(networkContext.selectedNetwork)
      })
      .map(tool => tool.name)
  }

  /**
   * Get max steps for a model
   */
  getMaxSteps(modelId: string, searchMode: boolean): number {
    const capability = this.getModelCapability(modelId)
    return searchMode ? capability.maxSteps : Math.min(capability.maxSteps, 5)
  }
}

/**
 * Create and initialize the tool registry with all available tools
 */
export function createToolRegistry(model: string): ToolRegistry {
  const registry = new ToolRegistry()
  
  const searchTool = createSearchTool(model)
  const videoSearchTool = createVideoSearchTool(model)
  const askQuestionTool = createQuestionTool(model)

  registry.registerTool({
    name: 'get_gas_price',
    description: 'Get the proposed gas price',
    schema: getGasPriceTool.parameters,
    execute: async (params, context, networkContext) => getGasPriceTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'sepolia', 'berachain', 'demo']
  })
  
  registry.registerTool({
    name: 'search',
    description: 'Search the web for information',
    schema: searchSchema,
    execute: async (params, context, networkContext) => searchTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'retrieve',
    description: 'Get detailed content from specific URLs',
    schema: retrieveTool.parameters,
    execute: async (params, context, networkContext) => retrieveTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'videoSearch',
    description: 'Search for video content',
    schema: videoSearchTool.parameters,
    execute: async (params, context, networkContext) => videoSearchTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'ask_question',
    description: 'Ask clarifying questions to the user',
    schema: askQuestionTool.parameters,
    execute: async (params, context, networkContext) => {
      return { success: true, message: `Question asked: ${params.question}` }
    },
    category: ToolCategory.UTILITY
  })
  
  registry.registerTool({
    name: 'market_chart',
    description: 'Fetch and display cryptocurrency market chart data',
    schema: marketChartTool.parameters,
    execute: async (params, context, networkContext) => marketChartTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'pendle_opportunities',
    description: 'Get Pendle yield opportunities on Ethereum',
    schema: pendleOpportunitiesTool.parameters,
    execute: async (params, context, networkContext) => pendleOpportunitiesTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'pendle_quote',
    description: 'Get a quote for swapping ETH to a Pendle token',
    schema: pendleQuoteTool.parameters,
    execute: async (params, context, networkContext) => pendleQuoteTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'pendle_swap',
    description: pendleSwapTool.description || '',
    schema: pendleSwapTool.parameters,
    execute: async (params, context, networkContext) => pendleSwapTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'wallet_balance',
    description: 'Get wallet balance information',
    schema: walletBalanceTool.parameters,
    execute: async (params, context, networkContext) => walletBalanceTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'sepolia', 'berachain', 'demo']
  })
  
  registry.registerTool({
    name: 'privy_transfer',
    description: 'Transfer ETH to a specified address',
    schema: privyTransferTool.parameters,
    execute: async (params, context, networkContext) => privyTransferTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'sepolia', 'berachain', 'demo']
  })
  
  registry.registerTool({
    name: 'kodiak_opportunities',
    description: 'Get Kodiak Island yield opportunities on Berachain',
    schema: kodiakOpportunitiesTool.parameters,
    execute: async (params, context, networkContext) => kodiakOpportunitiesTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['berachain']
  })
  
  registry.registerTool({
    name: 'kodiak_deposit',
    description: 'Deposit a single token into a Kodiak Island yield opportunity on Berachain',
    schema: kodiakDepositTool.parameters,
    execute: async (params, context, networkContext) => kodiakDepositTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['berachain']
  })
  
  registry.registerTool({
    name: 'generic_swap',
    description: 'Execute a swap transaction between two arbitrary tokens',
    schema: genericSwapTool.parameters,
    execute: async (params, context, networkContext) => genericSwapTool.execute(params, { toolCallId: context?.toolCallId, messages: context?.messages || [] }),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'sepolia', 'berachain', 'demo']
  })
  
  return registry
}

let toolRegistryInstance: ToolRegistry | null = null

export function getToolRegistry(model: string): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = createToolRegistry(model)
  }
  return toolRegistryInstance
}

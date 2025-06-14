import { ChainType } from '@/lib/network/types'
import { z } from 'zod'
import { searchSchema } from '../schema/search'
import { getGasPriceTool } from '../tools/gas-price'
import { kodiakBaultProfitabilityTool, kodiakCompoundBaultTool, kodiakDepositTool, kodiakOpportunitiesTool } from '../tools/kodiak'
import { bridgeExecuteTool, bridgeQuoteTool } from '../tools/lifi-bridge'
import { marketChartTool } from '../tools/market-chart'
import { pendleOpportunitiesTool, pendleQuoteTool, pendleRedeemPTTool, pendleRedeemYTTool, pendleSwapTool } from '../tools/pendle'
import { privyTransferTool } from '../tools/privy-transfer'
import { createQuestionTool } from '../tools/question'
import { retrieveTool } from '../tools/retrieve'
import { createSearchTool } from '../tools/search'
import { createVideoSearchTool } from '../tools/video-search'
import { fundWalletTool, walletBalanceTool } from '../tools/wallet'
import { NetworkContext, ToolContext } from '../types/context'



/**
 * Interface for tool definition with schema and execution function
 */
export interface ToolDefinition<T = any> {
  name: string
  description: string
  schema: z.ZodType<T>
  execute?: (params: T, context?: ToolContext) => Promise<any> | PromiseLike<any>
  category: ToolCategory
  supportedNetworks?: (ChainType | 'demo')[]
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
    execute: async (params, context) => getGasPriceTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'berachain', 'demo', 'base', 'arbitrum', 'polygon', 'optimism']
  })
  
  registry.registerTool({
    name: 'search',
    description: 'Search the web for information',
    schema: searchSchema,
    execute: async (params, context) => searchTool.execute(params, { 
      toolCallId: context?.toolCallId || 'unknown', 
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'retrieve',
    description: 'Get detailed content from specific URLs',
    schema: retrieveTool.parameters,
    execute: async (params, context) => retrieveTool.execute(params, { 
      toolCallId: context?.toolCallId || 'unknown', 
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'videoSearch',
    description: 'Search for video content',
    schema: videoSearchTool.parameters,
    execute: async (params, context) => videoSearchTool.execute(params, { 
      toolCallId: context?.toolCallId || 'unknown', 
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'ask_question',
    description: 'Ask clarifying questions to the user',
    schema: askQuestionTool.parameters,
    category: ToolCategory.UTILITY
  })
  
  registry.registerTool({
    name: 'market_chart',
    description: 'Fetch and display cryptocurrency market chart data',
    schema: marketChartTool.parameters,
    execute: async (params, context) => marketChartTool.execute(params, { 
      toolCallId: context?.toolCallId || 'unknown', 
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB
  })
  
  registry.registerTool({
    name: 'pendle_opportunities',
    description: 'Get Pendle yield opportunities on Ethereum',
    schema: pendleOpportunitiesTool.parameters,
    execute: async (params, context) => pendleOpportunitiesTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'pendle_quote',
    description: 'Get a quote for swapping ETH to a Pendle token',
    schema: pendleQuoteTool.parameters,
    execute: async (params, context) => pendleQuoteTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'pendle_swap',
    description: pendleSwapTool.description || '',
    schema: pendleSwapTool.parameters,
    execute: async (params, context) => pendleSwapTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'pendle_redeem_pt',
    description: pendleRedeemPTTool.description || '',
    schema: pendleRedeemPTTool.parameters,
    execute: async (params, context) => pendleRedeemPTTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'pendle_redeem_yt',
    description: pendleRedeemYTTool.description || '',
    schema: pendleRedeemYTTool.parameters,
    execute: async (params, context) => pendleRedeemYTTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'demo']
  })
  
  registry.registerTool({
    name: 'wallet_balance',
    description: 'Get wallet balance information',
    schema: walletBalanceTool.parameters,
    execute: async (params, context) => walletBalanceTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'berachain', 'demo', 'base', 'arbitrum', 'polygon', 'optimism']
  })
  
  registry.registerTool({
    name: 'privy_transfer',
    description: privyTransferTool.description || '',
    schema: privyTransferTool.parameters,
    execute: async (params, context) => privyTransferTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'berachain', 'demo', 'base', 'arbitrum', 'polygon', 'optimism']
  })
  
  registry.registerTool({
    name: 'kodiak_opportunities',
    description: 'Get Kodiak Island yield opportunities on Berachain',
    schema: kodiakOpportunitiesTool.parameters,
    execute: async (params, context) => kodiakOpportunitiesTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['berachain']
  })
  
  registry.registerTool({
    name: 'kodiak_deposit',
    description: 'Deposit a single token into a Kodiak Island yield opportunity on Berachain',
    schema: kodiakDepositTool.parameters,
    execute: async (params, context) => kodiakDepositTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['berachain']
  })
  

  registry.registerTool({
    name: 'kodiak_bault_profitability',
    description: 'Check the profitability of Kodiak Baults for compounding',
    schema: kodiakBaultProfitabilityTool.parameters,
    execute: async (params, context) => kodiakBaultProfitabilityTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['berachain']
  })
  
  registry.registerTool({
    name: 'kodiak_compound_bault',
    description: 'Compound a profitable Kodiak Bault using the BountyHelper contract',
    schema: kodiakCompoundBaultTool.parameters,
    execute: async (params, context) => kodiakCompoundBaultTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['berachain']
  })

  // Disabled enso swap as lifi bridge is used instead, it covers both cross-chain bridging and non cross-chain swap

  // registry.registerTool({
  //   name: 'generic_swap',
  //   description: 'Execute a swap transaction between two arbitrary tokens',
  //   schema: genericSwapTool.parameters,
  //   execute: async (params, context) => genericSwapTool.execute(params, {
  //     toolCallId: context?.toolCallId || 'unknown',
  //     messages: context?.messages || [],
  //     networkContext: context?.networkContext!
  //   } as any),
  //   category: ToolCategory.WEB3,
  //   supportedNetworks: ['ethereum', 'berachain', 'demo']
  // })

  registry.registerTool({
    name: 'lifi_bridge_quote',
    description: bridgeQuoteTool.description || '',
    schema: bridgeQuoteTool.parameters,
    execute: async (params, context) => bridgeQuoteTool.execute(params, { 
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'berachain', 'demo', 'base', 'arbitrum', 'polygon', 'optimism']
  })

  registry.registerTool({
    name: 'lifi_bridge_execute',
    description: bridgeExecuteTool.description || '',
    schema: bridgeExecuteTool.parameters,
    execute: async (params, context) => bridgeExecuteTool.execute(params, { 
      toolCallId: context?.toolCallId || 'unknown', 
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['ethereum', 'berachain', 'demo', 'base', 'arbitrum', 'polygon', 'optimism']
  })

  
  registry.registerTool({
    name: 'fund_wallet',
    description: 'Fund a wallet with ETH (only available in Demo mode)',
    schema: fundWalletTool.parameters,
    execute: async (params, context) => fundWalletTool.execute(params, {
      toolCallId: context?.toolCallId || 'unknown',
      messages: context?.messages || [],
      networkContext: context?.networkContext!
    } as any),
    category: ToolCategory.WEB3,
    supportedNetworks: ['demo']
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

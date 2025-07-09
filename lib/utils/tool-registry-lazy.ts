import { ChainType } from '@/lib/network/types'
import { z } from 'zod'
import { searchSchema } from '../schema/search'
import { NetworkContext, ToolContext } from '../types/context'

/**
 * Interface for tool definition with schema and execution function
 */
export interface ToolDefinition<T = any> {
  name: string
  description: string
  schema: z.ZodType<T>
  execute?: (
    params: T,
    context?: ToolContext
  ) => Promise<any> | PromiseLike<any>
  category: ToolCategory
  supportedNetworks?: (ChainType | 'demo')[]
}

/**
 * Interface for tool loader - lazy loading function
 */
export interface ToolLoader {
  name: string
  description: string
  category: ToolCategory
  supportedNetworks?: (ChainType | 'demo')[]
  loader: () => Promise<{
    schema: z.ZodType<any>
    execute?: (params: any, context?: ToolContext) => Promise<any> | PromiseLike<any>
  }>
}

/**
 * Tool categories for organization and filtering
 */
export enum ToolCategory {
  WEB = 'web',
  WEB3_READ = 'web3_read',
  WEB3_WRITE = 'web3_write',
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
 * Lazy-loading tool registry for memory optimization
 */
export class LazyToolRegistry {
  private toolLoaders: Map<string, ToolLoader> = new Map()
  private loadedTools: Map<string, ToolDefinition> = new Map()
  private modelCapabilities: Map<string, ModelCapability> = new Map()
  private readonly MAX_LOADED_TOOLS = 50 // Prevent cache from growing indefinitely

  constructor() {
    this.modelCapabilities.set('default', {
      supportedCategories: [
        ToolCategory.WEB,
        ToolCategory.WEB3_READ,
        ToolCategory.WEB3_WRITE,
        ToolCategory.UTILITY
      ],
      maxSteps: 10
    })

    this.modelCapabilities.set('openai:o3-mini', {
      supportedCategories: [ToolCategory.WEB, ToolCategory.UTILITY],
      maxSteps: 5
    })
  }

  /**
   * Register a tool loader
   */
  registerToolLoader(loader: ToolLoader): void {
    this.toolLoaders.set(loader.name, loader)
  }

  /**
   * Register a tool directly (for debugging/temporary use)
   */
  registerTool(tool: ToolDefinition): void {
    this.loadedTools.set(tool.name, tool)
  }

  /**
   * Get a tool by name (lazy loads if needed)
   */
  async getTool(name: string): Promise<ToolDefinition | undefined> {
    // Return cached tool if already loaded
    if (this.loadedTools.has(name)) {
      return this.loadedTools.get(name)
    }

    // Get tool loader
    const loader = this.toolLoaders.get(name)
    if (!loader) {
      return undefined
    }

    // Load tool lazily
    try {
      const toolImplementation = await loader.loader()
      
      const toolDefinition: ToolDefinition = {
        name: loader.name,
        description: loader.description,
        schema: toolImplementation.schema,
        execute: toolImplementation.execute,
        category: loader.category,
        supportedNetworks: loader.supportedNetworks
      }

      // Cache the loaded tool with size limit
      if (this.loadedTools.size >= this.MAX_LOADED_TOOLS) {
        // Remove oldest tool to make room
        const firstKey = this.loadedTools.keys().next().value
        if (firstKey) {
          this.loadedTools.delete(firstKey)
          console.log(`🧹 Evicted tool ${firstKey} from cache`)
        }
      }
      this.loadedTools.set(name, toolDefinition)
      return toolDefinition
    } catch (error) {
      console.error(`Failed to load tool ${name}:`, error)
      return undefined
    }
  }

  /**
   * Get all tool loaders (without loading actual tools)
   */
  getAllToolLoaders(): ToolLoader[] {
    return Array.from(this.toolLoaders.values())
  }

  /**
   * Get all loaded tools
   */
  getAllLoadedTools(): ToolDefinition[] {
    return Array.from(this.loadedTools.values())
  }

  /**
   * Get tool loaders by category
   */
  getToolLoadersByCategory(category: ToolCategory): ToolLoader[] {
    return this.getAllToolLoaders().filter(loader => loader.category === category)
  }

  /**
   * Get tool names by category
   */
  getToolNamesByCategory(category: ToolCategory): string[] {
    return this.getToolLoadersByCategory(category).map(loader => loader.name)
  }

  /**
   * Get all tool names
   */
  getAllToolNames(): string[] {
    return Array.from(this.toolLoaders.keys())
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
    return (
      this.modelCapabilities.get(modelId) ||
      this.modelCapabilities.get('default')!
    )
  }

  /**
   * Get supported tool names for a model
   */
  getSupportedToolNames(modelId: string): string[] {
    const capability = this.getModelCapability(modelId)
    return this.getAllToolLoaders()
      .filter(loader => capability.supportedCategories.includes(loader.category))
      .map(loader => loader.name)
  }

  /**
   * Get supported tool names for a model with network filtering
   */
  getSupportedToolNamesForNetwork(
    modelId: string,
    networkContext: NetworkContext
  ): string[] {
    const capability = this.getModelCapability(modelId)
    return this.getAllToolLoaders()
      .filter(loader => capability.supportedCategories.includes(loader.category))
      .filter(loader => {
        // If tool doesn't specify supported networks, it supports all networks
        if (!loader.supportedNetworks) return true
        // Otherwise, check if current network is supported
        return loader.supportedNetworks.includes(networkContext.selectedNetwork)
      })
      .map(loader => loader.name)
  }

  /**
   * Get max steps for a model
   */
  getMaxSteps(modelId: string, searchMode: boolean): number {
    const capability = this.getModelCapability(modelId)
    return searchMode ? capability.maxSteps : Math.min(capability.maxSteps, 5)
  }

  /**
   * Preload specific tools (for performance optimization)
   */
  async preloadTools(toolNames: string[]): Promise<void> {
    const promises = toolNames.map(name => this.getTool(name))
    await Promise.all(promises)
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    totalLoaders: number
    loadedTools: number
    memoryEfficiency: number
  } {
    const totalLoaders = this.toolLoaders.size
    const loadedTools = this.loadedTools.size
    const memoryEfficiency = totalLoaders > 0 ? (1 - loadedTools / totalLoaders) * 100 : 0

    return {
      totalLoaders,
      loadedTools,
      memoryEfficiency
    }
  }
}

/**
 * Create and initialize the lazy tool registry
 */
export function createLazyToolRegistry(model: string): LazyToolRegistry {
  const registry = new LazyToolRegistry()

  // Register core tools with lazy loaders
  registry.registerToolLoader({
    name: 'search',
    description: 'Search the web for information',
    category: ToolCategory.WEB,
    loader: async () => {
      const { createSearchTool } = await import('../tools/search')
      const searchTool = createSearchTool(model)
      return {
        schema: searchSchema,
        execute: async (params, context) =>
          searchTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'retrieve',
    description: 'Get detailed content from specific URLs',
    category: ToolCategory.WEB,
    loader: async () => {
      const { retrieveTool } = await import('../tools/retrieve')
      return {
        schema: retrieveTool.parameters,
        execute: async (params, context) =>
          retrieveTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'videoSearch',
    description: 'Search for video content',
    category: ToolCategory.WEB,
    loader: async () => {
      const { createVideoSearchTool } = await import('../tools/video-search')
      const videoSearchTool = createVideoSearchTool(model)
      return {
        schema: videoSearchTool.parameters,
        execute: async (params, context) =>
          videoSearchTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'ask_question',
    description: 'Ask clarifying questions to the user',
    category: ToolCategory.UTILITY,
    loader: async () => {
      const { createQuestionTool } = await import('../tools/question')
      const askQuestionTool = createQuestionTool(model)
      return {
        schema: askQuestionTool.parameters
      }
    }
  })

  registry.registerToolLoader({
    name: 'market_chart',
    description: 'Fetch and display cryptocurrency market chart data',
    category: ToolCategory.WEB,
    loader: async () => {
      const { marketChartTool } = await import('../tools/market-chart')
      return {
        schema: marketChartTool.parameters,
        execute: async (params, context) =>
          marketChartTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'get_gas_price',
    description: 'Get the proposed gas price',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'berachain',
      'demo',
      'base',
      'arbitrum',
      'polygon',
      'optimism',
      'unichain',
      'bsc',
      'sonic'
    ],
    loader: async () => {
      const { getGasPriceTool } = await import('../tools/gas-price')
      return {
        schema: getGasPriceTool.parameters,
        execute: async (params, context) =>
          getGasPriceTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Pendle tools (heavy dependencies)
  registry.registerToolLoader({
    name: 'pendle_opportunities',
    description: 'Get Pendle yield opportunities',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleOpportunitiesTool } = await import('../tools/pendle')
      return {
        schema: pendleOpportunitiesTool.parameters,
        execute: async (params, context) =>
          pendleOpportunitiesTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_quote',
    description: 'Get a quote for swapping ETH to a Pendle token',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleQuoteTool } = await import('../tools/pendle')
      return {
        schema: pendleQuoteTool.parameters,
        execute: async (params, context) =>
          pendleQuoteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_swap',
    description: 'Execute Pendle swap transaction',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleSwapTool } = await import('../tools/pendle')
      return {
        schema: pendleSwapTool.parameters,
        execute: async (params, context) =>
          pendleSwapTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Wallet tools (heavy Alchemy dependencies)
  registry.registerToolLoader({
    name: 'wallet_balance',
    description: 'Get wallet balance information',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'berachain',
      'demo',
      'base',
      'arbitrum',
      'polygon',
      'optimism',
      'unichain',
      'bsc',
      'sonic'
    ],
    loader: async () => {
      const { walletBalanceTool } = await import('../tools/wallet')
      return {
        schema: walletBalanceTool.parameters,
        execute: async (params, context) =>
          walletBalanceTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'privy_transfer',
    description: 'Transfer tokens using Privy',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'berachain',
      'demo',
      'base',
      'arbitrum',
      'polygon',
      'optimism',
      'unichain',
      'bsc',
      'sonic'
    ],
    loader: async () => {
      const { privyTransferTool } = await import('../tools/privy-transfer')
      return {
        schema: privyTransferTool.parameters,
        execute: async (params, context) =>
          privyTransferTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Kodiak tools (Berachain specific)
  registry.registerToolLoader({
    name: 'kodiak_opportunities',
    description: 'Get Kodiak Island yield opportunities on Berachain',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: ['berachain'],
    loader: async () => {
      const { kodiakOpportunitiesTool } = await import('../tools/kodiak')
      return {
        schema: kodiakOpportunitiesTool.parameters,
        execute: async (params, context) =>
          kodiakOpportunitiesTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'kodiak_deposit',
    description: 'Deposit a single token into a Kodiak Island yield opportunity on Berachain',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: ['berachain'],
    loader: async () => {
      const { kodiakDepositTool } = await import('../tools/kodiak')
      return {
        schema: kodiakDepositTool.parameters,
        execute: async (params, context) =>
          kodiakDepositTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Bridge tools
  registry.registerToolLoader({
    name: 'lifi_bridge_quote',
    description: 'Get bridge quote for cross-chain transactions',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'berachain',
      'demo',
      'base',
      'arbitrum',
      'polygon',
      'optimism',
      'unichain',
      'bsc',
      'sonic'
    ],
    loader: async () => {
      const { bridgeQuoteTool } = await import('../tools/lifi-bridge')
      return {
        schema: bridgeQuoteTool.parameters,
        execute: async (params, context) =>
          bridgeQuoteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'lifi_bridge_execute',
    description: 'Execute bridge transaction for cross-chain transfers',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'berachain',
      'demo',
      'base',
      'arbitrum',
      'polygon',
      'optimism',
      'unichain',
      'bsc',
      'sonic'
    ],
    loader: async () => {
      const { bridgeExecuteTool } = await import('../tools/lifi-bridge')
      return {
        schema: bridgeExecuteTool.parameters,
        execute: async (params, context) =>
          bridgeExecuteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // DeFiLlama tools
  registry.registerToolLoader({
    name: 'defillama_protocols',
    description: 'Get DeFi protocol data with TVL rankings, 7-day gainers, and filtering options for hunting opportunities',
    category: ToolCategory.WEB,
    loader: async () => {
      const { defiProtocolsTool } = await import('../tools/defillama-protocols')
      return {
        schema: defiProtocolsTool.parameters,
        execute: async (params, context) =>
          defiProtocolsTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'defillama_yields',
    description: 'Discover high-yield DeFi opportunities across different protocols and chains',
    category: ToolCategory.WEB,
    loader: async () => {
      const { defiYieldsTool } = await import('../tools/defillama-yields')
      return {
        schema: defiYieldsTool.parameters,
        execute: async (params, context) =>
          defiYieldsTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Add remaining Pendle tools
  registry.registerToolLoader({
    name: 'pendle_redeem',
    description: 'Redeem Pendle position',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleRedeemTool } = await import('../tools/pendle')
      return {
        schema: pendleRedeemTool.parameters,
        execute: async (params, context) =>
          pendleRedeemTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_mint',
    description: 'Mint Pendle position',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleMintTool } = await import('../tools/pendle')
      return {
        schema: pendleMintTool.parameters,
        execute: async (params, context) =>
          pendleMintTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_redeem_quote',
    description: 'Get quote for Pendle redemption',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleRedeemQuoteTool } = await import('../tools/pendle')
      return {
        schema: pendleRedeemQuoteTool.parameters,
        execute: async (params, context) =>
          pendleRedeemQuoteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_mint_quote',
    description: 'Get quote for Pendle minting',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleMintQuoteTool } = await import('../tools/pendle')
      return {
        schema: pendleMintQuoteTool.parameters,
        execute: async (params, context) =>
          pendleMintQuoteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Pendle liquidity tools
  registry.registerToolLoader({
    name: 'pendle_zap_in_quote',
    description: 'Get quote for Pendle zap in',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleZapInQuoteTool } = await import('../tools/pendle-liquidity')
      return {
        schema: pendleZapInQuoteTool.parameters,
        execute: async (params, context) =>
          pendleZapInQuoteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_zap_in_execute',
    description: 'Execute Pendle zap in',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleZapInExecuteTool } = await import('../tools/pendle-liquidity')
      return {
        schema: pendleZapInExecuteTool.parameters,
        execute: async (params, context) =>
          pendleZapInExecuteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_zap_out_quote',
    description: 'Get quote for Pendle zap out',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleZapOutQuoteTool } = await import('../tools/pendle-remove-liquidity')
      return {
        schema: pendleZapOutQuoteTool.parameters,
        execute: async (params, context) =>
          pendleZapOutQuoteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'pendle_zap_out_execute',
    description: 'Execute Pendle zap out',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: [
      'ethereum',
      'bsc',
      'arbitrum',
      'base',
      'sonic',
      'berachain',
      'optimism',
      'mantle',
      'demo'
    ],
    loader: async () => {
      const { pendleZapOutExecuteTool } = await import('../tools/pendle-remove-liquidity')
      return {
        schema: pendleZapOutExecuteTool.parameters,
        execute: async (params, context) =>
          pendleZapOutExecuteTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Additional Kodiak tools
  registry.registerToolLoader({
    name: 'kodiak_bault_profitability',
    description: 'Check the profitability of Kodiak Baults for compounding',
    category: ToolCategory.WEB3_READ,
    supportedNetworks: ['berachain'],
    loader: async () => {
      const { kodiakBaultProfitabilityTool } = await import('../tools/kodiak')
      return {
        schema: kodiakBaultProfitabilityTool.parameters,
        execute: async (params, context) =>
          kodiakBaultProfitabilityTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'kodiak_compound_bault',
    description: 'Compound a profitable Kodiak Bault using the BountyHelper contract',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: ['berachain'],
    loader: async () => {
      const { kodiakCompoundBaultTool } = await import('../tools/kodiak')
      return {
        schema: kodiakCompoundBaultTool.parameters,
        execute: async (params, context) =>
          kodiakCompoundBaultTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!
          } as any)
      }
    }
  })

  // Demo wallet tools
  registry.registerToolLoader({
    name: 'fund_wallet',
    description: 'Fund a wallet with ETH (only available in Demo mode)',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: ['demo'],
    loader: async () => {
      const { fundWalletTool } = await import('../tools/wallet')
      return {
        schema: fundWalletTool.parameters,
        execute: async (params, context) =>
          fundWalletTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!,
            isNewUser: context?.isNewUser
          } as any)
      }
    }
  })

  registry.registerToolLoader({
    name: 'initial_wallet_reward',
    description: 'Grant initial wallet reward of 1 ETH to new users (only available in Demo mode)',
    category: ToolCategory.WEB3_WRITE,
    supportedNetworks: ['demo'],
    loader: async () => {
      const { initialWalletRewardTool } = await import('../tools/wallet')
      return {
        schema: initialWalletRewardTool.parameters,
        execute: async (params, context) =>
          initialWalletRewardTool.execute(params, {
            toolCallId: context?.toolCallId || 'unknown',
            messages: context?.messages || [],
            networkContext: context?.networkContext!,
            isNewUser: context?.isNewUser
          } as any)
      }
    }
  })

  return registry
}

let lazyToolRegistryInstance: LazyToolRegistry | null = null

export function getLazyToolRegistry(model: string): LazyToolRegistry {
  if (!lazyToolRegistryInstance) {
    lazyToolRegistryInstance = createLazyToolRegistry(model)
  }
  return lazyToolRegistryInstance
}
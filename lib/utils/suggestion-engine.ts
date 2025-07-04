import { ToolDefinition, ToolCategory, ToolRegistry, getToolRegistry } from './tool-registry'
import { NetworkContext } from '../types/context'

export interface Suggestion {
  id: string
  text: string
  description: string
  category: 'tool' | 'token' | 'protocol' | 'command'
  icon?: string
  score: number
  toolName?: string
  isComplete?: boolean
}

export interface SuggestionContext {
  networkContext: NetworkContext
  walletAddress?: string
  isDemo?: boolean
  previousMessages?: string[]
  userInput: string
  cursorPosition: number
}

/**
 * Main suggestion engine class for intelligent autocomplete
 */
export class SuggestionEngine {
  private toolRegistry: ToolRegistry
  
  // Common DeFi tokens and protocols
  private commonTokens = [
    'ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'BTC', 'WBTC',
    'AAVE', 'UNI', 'COMP', 'MKR', 'LINK', 'SNX', 'CRV',
    'YFI', 'SUSHI', 'BAL', 'PENDLE', 'PT', 'YT', 'SY',
    'eETH', 'weETH', 'stETH', 'rETH', 'cbETH', 'sDAI',
    'sENA', 'ENA', 'HONEY', 'BERA', 'BGT'
  ]

  private commonProtocols = [
    'Uniswap', 'Pendle', 'Aave', 'Compound', 'MakerDAO',
    'Curve', 'Yearn', 'SushiSwap', 'Balancer', 'Kodiak',
    'Ether.fi', 'Lido', 'Rocket Pool', 'Coinbase'
  ]

  private commonActions = [
    'check wallet balance', 'check my balance', 'swap tokens',
    'add liquidity', 'remove liquidity', 'zap in', 'zap out',
    'get gas price', 'bridge tokens', 'mint tokens', 'redeem tokens',
    'search for', 'find opportunities', 'check yield',
    'transfer tokens', 'fund wallet', 'pendle swap',
    'get market data', 'check price', 'view chart'
  ]

  constructor(modelId: string = 'default') {
    this.toolRegistry = getToolRegistry(modelId)
  }

  /**
   * Generate suggestions based on user input and context
   */
  async generateSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const { userInput, networkContext } = context
    const input = userInput.toLowerCase().trim()
    
    if (!input) {
      return this.getDefaultSuggestions(context)
    }

    const suggestions: Suggestion[] = []
    
    // Get tool-based suggestions
    const toolSuggestions = await this.getToolSuggestions(input, context)
    suggestions.push(...toolSuggestions)
    
    // Get token suggestions
    const tokenSuggestions = this.getTokenSuggestions(input, context)
    suggestions.push(...tokenSuggestions)
    
    // Get protocol suggestions
    const protocolSuggestions = this.getProtocolSuggestions(input, context)
    suggestions.push(...protocolSuggestions)
    
    // Get action suggestions
    const actionSuggestions = this.getActionSuggestions(input, context)
    suggestions.push(...actionSuggestions)
    
    // Sort by score and return top 8
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }

  /**
   * Get default suggestions when input is empty
   */
  private getDefaultSuggestions(context: SuggestionContext): Suggestion[] {
    const { networkContext } = context
    
    const suggestions: Suggestion[] = [
      {
        id: 'check-balance',
        text: 'Check my wallet balance',
        description: 'View your current token balances',
        category: 'command',
        icon: 'Wallet',
        score: 100,
        toolName: 'wallet_balance'
      },
      {
        id: 'swap-tokens',
        text: 'Swap tokens',
        description: 'Exchange one token for another',
        category: 'command',
        icon: 'ArrowRightLeft',
        score: 95,
        toolName: 'lifi_bridge_quote'
      },
      {
        id: 'pendle-opportunities',
        text: 'Find Pendle opportunities',
        description: 'Discover yield farming opportunities',
        category: 'command',
        icon: 'TrendingUp',
        score: 90,
        toolName: 'pendle_opportunities'
      },
      {
        id: 'gas-price',
        text: 'Check gas price',
        description: 'Get current network gas prices',
        category: 'command',
        icon: 'Fuel',
        score: 85,
        toolName: 'get_gas_price'
      }
    ]

    // Add network-specific suggestions
    if (networkContext.selectedNetwork === 'berachain') {
      suggestions.push({
        id: 'kodiak-opportunities',
        text: 'Find Kodiak opportunities',
        description: 'Discover Berachain yield opportunities',
        category: 'command',
        icon: 'Mountain',
        score: 92,
        toolName: 'kodiak_opportunities'
      })
    }

    return suggestions
  }

  /**
   * Get tool-based suggestions
   */
  private async getToolSuggestions(
    input: string,
    context: SuggestionContext
  ): Promise<Suggestion[]> {
    const tools = this.toolRegistry.getSupportedToolNamesForNetwork(
      'default',
      context.networkContext
    )
    
    const suggestions: Suggestion[] = []
    
    for (const toolName of tools) {
      const tool = this.toolRegistry.getTool(toolName)
      if (!tool) continue
      
      const score = this.calculateToolScore(tool, input, context)
      if (score > 0) {
        suggestions.push({
          id: `tool-${toolName}`,
          text: this.generateToolSuggestionText(tool, input),
          description: tool.description,
          category: 'tool',
          icon: this.getToolIcon(tool),
          score,
          toolName: tool.name
        })
      }
    }
    
    return suggestions
  }

  /**
   * Calculate relevance score for a tool
   */
  private calculateToolScore(
    tool: ToolDefinition,
    input: string,
    context: SuggestionContext
  ): number {
    let score = 0
    const toolName = tool.name.toLowerCase()
    const description = tool.description.toLowerCase()
    
    // Exact matches
    if (toolName.includes(input) || description.includes(input)) {
      score += 50
    }
    
    // Keyword matching
    const keywords = this.extractKeywords(input)
    for (const keyword of keywords) {
      if (toolName.includes(keyword) || description.includes(keyword)) {
        score += 20
      }
    }
    
    // Category-based scoring
    if (tool.category === ToolCategory.WEB3_READ) score += 10
    if (tool.category === ToolCategory.WEB3_WRITE) score += 15
    
    // Network-specific bonuses
    if (context.networkContext.selectedNetwork === 'berachain' && 
        toolName.includes('kodiak')) {
      score += 20
    }
    
    if (toolName.includes('pendle')) {
      score += 15
    }
    
    return score
  }

  /**
   * Generate suggestion text for a tool
   */
  private generateToolSuggestionText(tool: ToolDefinition, input: string): string {
    const toolName = tool.name.toLowerCase()
    
    // Generate contextual suggestions based on tool type
    if (toolName.includes('balance')) {
      return 'Check my wallet balance'
    }
    if (toolName.includes('swap')) {
      return 'Swap tokens'
    }
    if (toolName.includes('bridge')) {
      return 'Bridge tokens between chains'
    }
    if (toolName.includes('pendle')) {
      if (toolName.includes('opportunities')) {
        return 'Find Pendle yield opportunities'
      }
      if (toolName.includes('zap_in')) {
        return 'Zap into Pendle pool'
      }
      if (toolName.includes('zap_out')) {
        return 'Zap out of Pendle pool'
      }
    }
    if (toolName.includes('kodiak')) {
      return 'Find Kodiak Island opportunities'
    }
    if (toolName.includes('gas')) {
      return 'Check current gas price'
    }
    
    // Default to description or tool name
    return tool.description || tool.name
  }

  /**
   * Get token suggestions
   */
  private getTokenSuggestions(
    input: string,
    context: SuggestionContext
  ): Suggestion[] {
    const suggestions: Suggestion[] = []
    
    for (const token of this.commonTokens) {
      const score = this.calculateTokenScore(token, input, context)
      if (score > 0) {
        suggestions.push({
          id: `token-${token}`,
          text: token,
          description: `${token} token`,
          category: 'token',
          icon: 'Coins',
          score
        })
      }
    }
    
    return suggestions
  }

  /**
   * Calculate token relevance score
   */
  private calculateTokenScore(
    token: string,
    input: string,
    context: SuggestionContext
  ): number {
    const tokenLower = token.toLowerCase()
    
    if (tokenLower.startsWith(input)) {
      return 70
    }
    if (tokenLower.includes(input)) {
      return 40
    }
    
    return 0
  }

  /**
   * Get protocol suggestions
   */
  private getProtocolSuggestions(
    input: string,
    context: SuggestionContext
  ): Suggestion[] {
    const suggestions: Suggestion[] = []
    
    for (const protocol of this.commonProtocols) {
      const score = this.calculateProtocolScore(protocol, input, context)
      if (score > 0) {
        suggestions.push({
          id: `protocol-${protocol}`,
          text: protocol,
          description: `${protocol} protocol`,
          category: 'protocol',
          icon: 'Building',
          score
        })
      }
    }
    
    return suggestions
  }

  /**
   * Calculate protocol relevance score
   */
  private calculateProtocolScore(
    protocol: string,
    input: string,
    context: SuggestionContext
  ): number {
    const protocolLower = protocol.toLowerCase()
    
    if (protocolLower.startsWith(input)) {
      return 60
    }
    if (protocolLower.includes(input)) {
      return 30
    }
    
    return 0
  }

  /**
   * Get action suggestions
   */
  private getActionSuggestions(
    input: string,
    context: SuggestionContext
  ): Suggestion[] {
    const suggestions: Suggestion[] = []
    
    for (const action of this.commonActions) {
      const score = this.calculateActionScore(action, input, context)
      if (score > 0) {
        suggestions.push({
          id: `action-${action}`,
          text: action,
          description: `${action}`,
          category: 'command',
          icon: 'Zap',
          score
        })
      }
    }
    
    return suggestions
  }

  /**
   * Calculate action relevance score
   */
  private calculateActionScore(
    action: string,
    input: string,
    context: SuggestionContext
  ): number {
    const actionLower = action.toLowerCase()
    
    if (actionLower.startsWith(input)) {
      return 80
    }
    if (actionLower.includes(input)) {
      return 50
    }
    
    // Check for partial word matches
    const keywords = this.extractKeywords(input)
    for (const keyword of keywords) {
      if (actionLower.includes(keyword)) {
        return 35
      }
    }
    
    return 0
  }

  /**
   * Extract keywords from input
   */
  private extractKeywords(input: string): string[] {
    return input.toLowerCase().split(/\s+/).filter(word => word.length > 2)
  }

  /**
   * Get icon for tool category
   */
  private getToolIcon(tool: ToolDefinition): string {
    const toolName = tool.name.toLowerCase()
    
    if (toolName.includes('balance')) return 'Wallet'
    if (toolName.includes('swap') || toolName.includes('bridge')) return 'ArrowRightLeft'
    if (toolName.includes('gas')) return 'Fuel'
    if (toolName.includes('pendle')) return 'TrendingUp'
    if (toolName.includes('kodiak')) return 'Mountain'
    if (toolName.includes('search')) return 'Search'
    if (toolName.includes('transfer')) return 'Send'
    if (toolName.includes('chart')) return 'BarChart3'
    
    switch (tool.category) {
      case ToolCategory.WEB3_READ:
        return 'Eye'
      case ToolCategory.WEB3_WRITE:
        return 'Edit'
      case ToolCategory.WEB:
        return 'Globe'
      case ToolCategory.UTILITY:
        return 'Tool'
      default:
        return 'Zap'
    }
  }
}

/**
 * Create suggestion engine instance
 */
export function createSuggestionEngine(modelId: string = 'default'): SuggestionEngine {
  return new SuggestionEngine(modelId)
}
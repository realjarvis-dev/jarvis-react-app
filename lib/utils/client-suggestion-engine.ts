'use client'

/**
 * Client-safe suggestion engine for autocomplete
 * This version doesn't import server-only dependencies
 */

export interface ClientSuggestion {
  id: string
  text: string
  description: string
  category: 'tool' | 'token' | 'protocol' | 'command'
  icon?: string
  score: number
  toolName?: string
  isComplete?: boolean
}

export interface ClientSuggestionContext {
  selectedNetwork: string
  isDemoMode: boolean
  userInput: string
  cursorPosition: number
}

/**
 * Client-safe suggestion engine class
 */
export class ClientSuggestionEngine {
  // Common DeFi tokens
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

  /**
   * Generate suggestions based on user input and context
   */
  async generateSuggestions(context: ClientSuggestionContext): Promise<ClientSuggestion[]> {
    const { userInput } = context
    const input = userInput.toLowerCase().trim()
    
    if (!input) {
      return this.getDefaultSuggestions(context)
    }

    // Check if user has already provided a complete query
    const isCompleteQuery = input.length > 10 && (
      input.includes('check') && input.includes('balance') ||
      input.includes('swap') && input.includes('for') ||
      input.includes('find') && input.includes('opportunities') ||
      input.includes('get') && input.includes('price') ||
      input.includes('compare') && input.includes('returns') ||
      input.split(' ').length >= 4 // 4+ words likely indicates a complete query
    )

    // Don't show suggestions if user has a complete query
    if (isCompleteQuery) {
      return []
    }

    // Only show suggestions for short queries (15 characters or less)
    if (input.length > 15) {
      return []
    }

    const suggestions: ClientSuggestion[] = []
    
    // Get action suggestions
    const actionSuggestions = this.getActionSuggestions(input, context)
    suggestions.push(...actionSuggestions)
    
    // Get token suggestions
    const tokenSuggestions = this.getTokenSuggestions(input, context)
    suggestions.push(...tokenSuggestions)
    
    // Get protocol suggestions
    const protocolSuggestions = this.getProtocolSuggestions(input, context)
    suggestions.push(...protocolSuggestions)
    
    // Sort by score and return top 8
    const finalSuggestions = suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
    
    return finalSuggestions
  }

  /**
   * Get default suggestions when input is empty
   */
  private getDefaultSuggestions(context: ClientSuggestionContext): ClientSuggestion[] {
    const suggestions: ClientSuggestion[] = [
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
    if (context.selectedNetwork === 'berachain') {
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
   * Get token suggestions
   */
  private getTokenSuggestions(
    input: string,
    context: ClientSuggestionContext
  ): ClientSuggestion[] {
    const suggestions: ClientSuggestion[] = []
    
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
    context: ClientSuggestionContext
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
    context: ClientSuggestionContext
  ): ClientSuggestion[] {
    const suggestions: ClientSuggestion[] = []
    
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
    context: ClientSuggestionContext
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
    context: ClientSuggestionContext
  ): ClientSuggestion[] {
    const suggestions: ClientSuggestion[] = []
    
    for (const action of this.commonActions) {
      const score = this.calculateActionScore(action, input, context)
      if (score > 0) {
        suggestions.push({
          id: `action-${action}`,
          text: action,
          description: `${action}`,
          category: 'command',
          icon: this.getActionIcon(action),
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
    context: ClientSuggestionContext
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
   * Get icon for action
   */
  private getActionIcon(action: string): string {
    const actionLower = action.toLowerCase()
    
    if (actionLower.includes('balance')) return 'Wallet'
    if (actionLower.includes('swap') || actionLower.includes('bridge')) return 'ArrowRightLeft'
    if (actionLower.includes('gas')) return 'Fuel'
    if (actionLower.includes('pendle') || actionLower.includes('yield')) return 'TrendingUp'
    if (actionLower.includes('kodiak')) return 'Mountain'
    if (actionLower.includes('search')) return 'Search'
    if (actionLower.includes('transfer')) return 'Send'
    if (actionLower.includes('chart') || actionLower.includes('price')) return 'BarChart3'
    if (actionLower.includes('liquidity')) return 'Waves'
    if (actionLower.includes('mint') || actionLower.includes('redeem')) return 'Coins'
    
    return 'Zap'
  }
}

/**
 * Create client-safe suggestion engine instance
 */
export function createClientSuggestionEngine(): ClientSuggestionEngine {
  return new ClientSuggestionEngine()
}
import { tool } from 'ai'
import { z } from 'zod'
import { NetworkContext } from '../utils/tool-registry'
import { getWalletBalances } from '../utils/wallet'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const walletBalanceTool = tool({
  description: 'Get wallet balance information for all tokens or a specific token.',
  parameters: z.object({
    wallet_address: z.string()
      .describe('Specific EVM wallet address to check'),
    token_symbol: z.string().optional()
      .describe('Specific token symbol to filter by (e.g., "ETH", "DAI", etc.)')
  }),
  execute: async (params, context: ToolContext) => {
    const { wallet_address, token_symbol } = params;
    const networkContext = context?.networkContext;
    
    try {
      const walletBalances = await getWalletBalances(wallet_address)
      
      // If a specific token was requested, filter the results
      if (token_symbol) {
        const normalizedSymbol = token_symbol.toUpperCase()
        const filteredTokens = walletBalances.tokens.filter(
          token => token.symbol.toUpperCase() === normalizedSymbol
        )
        
        if (filteredTokens.length === 0) {
          const errorData = {
            success: false,
            message: `No tokens with symbol ${token_symbol} found in wallet.`,
            tokens: []
          }
          
          return {
            _uiDisplayTool: true,
            summary: `No ${token_symbol} found in wallet`,
            data: errorData
          }
        }
        
        const successData = {
          success: true,
          message: `Found ${token_symbol} balance`,
          tokens: filteredTokens,
          filtered: true,
          filter_symbol: token_symbol
        }
        
        return {
          _uiDisplayTool: true,
          summary: `Found ${token_symbol} balance: ${filteredTokens[0]?.balance || '0'}`,
          data: successData
        }
      }
      
      // Return all tokens
      const allTokensData = {
        success: true,
        message: 'Retrieved all wallet balances',
        tokens: walletBalances.tokens,
        filtered: false
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Found ${walletBalances.tokens.length} tokens in wallet`,
        data: allTokensData
      }
    } catch (error) {
      console.error('Error in wallet balance tool:', error)
      const errorData = {
        success: false,
        message: 'Failed to fetch wallet balances',
        tokens: []
      }
      
      return {
        _uiDisplayTool: true,
        summary: 'Error fetching wallet balances',
        data: errorData
      }
    }
  }
})
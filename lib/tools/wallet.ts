import { tool } from 'ai'
import { z } from 'zod'
import { getWalletBalances } from '../utils/wallet'

export const walletBalanceTool = tool({
  description: 'Get wallet balance information for all tokens or a specific token.',
  parameters: z.object({
    wallet_address: z.string()
      .describe('Specific EVM wallet address to check'),
    token_symbol: z.string().optional()
      .describe('Specific token symbol to filter by (e.g., "ETH", "DAI", etc.)')
  }),
  execute: async ({ wallet_address, token_symbol }) => {
    try {
      const walletBalances = await getWalletBalances(wallet_address)
      
      // If a specific token was requested, filter the results
      if (token_symbol) {
        const normalizedSymbol = token_symbol.toUpperCase()
        const filteredTokens = walletBalances.tokens.filter(
          token => token.symbol.toUpperCase() === normalizedSymbol
        )
        
        if (filteredTokens.length === 0) {
          return {
            success: false,
            message: `No tokens with symbol ${token_symbol} found in wallet.`,
            tokens: []
          }
        }
        
        return {
          success: true,
          message: `Found ${token_symbol} balance`,
          tokens: filteredTokens,
          filtered: true,
          filter_symbol: token_symbol
        }
      }
      
      // Return all tokens
      return {
        success: true,
        message: 'Retrieved all wallet balances',
        tokens: walletBalances.tokens,
        filtered: false
      }
    } catch (error) {
      console.error('Error in wallet balance tool:', error)
      return {
        success: false,
        message: 'Failed to fetch wallet balances',
        tokens: []
      }
    }
  }
})
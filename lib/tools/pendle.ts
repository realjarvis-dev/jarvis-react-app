import { getPendleOpportunitiesSchemaForModel } from '../schema/pendle'
import { tool } from 'ai'
import { ethers } from 'ethers'
import { z } from 'zod'
import { getConfigByChainId } from '../network/config'
import { getPendleMarkets } from '../pendle/api'
import { executePendleMintPy, getMintPyQuote } from '../pendle/mint-py'
import { executePendleMintSy, getMintSyQuote } from '../pendle/mint-sy'
import { executePendleRedeemPy, getRedeemPyQuote } from '../pendle/redeem-py'
import { executePendleRedeemSy, getRedeemSyQuote } from '../pendle/redeem-sy'
import { executePendleSwap, getSwapQuote } from '../pendle/swap'
import { getERC20Details } from '../privy/utils'
import { ToolContext } from '../types/context'

export function createPendleOpportunitiesTool(fullModel: string) {
  return tool({
    description:
      'Get Pendle yield opportunities. This tool automatically renders UI.',
    parameters: getPendleOpportunitiesSchemaForModel(fullModel),
    execute: async (params, context: ToolContext) => {
      const { max_results = 10, apy_gte = 0, apy_lte = 100 } = params;
      const networkContext = context?.networkContext;
      
      if (!networkContext?.selectedChainId) {
        throw new Error('Network context with selectedChainId is required');
      }
      
      const chainId = networkContext.selectedChainId;
      
      try {
        const markets = await getPendleMarkets('active', chainId)

        const decimal_apy_gte = apy_gte / 100
        const decimal_apy_lte = apy_lte / 100

        let filtered = markets
        if (apy_gte > 0)
          filtered = filtered.filter(o => o.impliedApy >= decimal_apy_gte)
        if (apy_lte < 100)
          filtered = filtered.filter(o => o.impliedApy <= decimal_apy_lte)
        filtered.sort((a, b) => b.impliedApy - a.impliedApy)
        const results = filtered.slice(0, max_results)
        
        return {
          _uiDisplayTool: true,
          summary: `Found ${results.length} Pendle yield opportunities`,
          count: results.length,
          data: results
        }
      } catch (error: any) {
        console.log(error)
        const errorData = {
          error: error.message || 'Failed to get opportunities',
          max_results,
          apy_gte,
          apy_lte
        }
        
        return {
          _uiDisplayTool: true,
          summary: `Error getting opportunities: ${error.message || 'Failed to get opportunities'}`,
          data: errorData
        }
      }
    }
  })
}

export const pendleOpportunitiesTool = createPendleOpportunitiesTool('openai:gpt-4o-mini')

export const pendleQuoteTool = tool({
  description:
    'Get a quote for swapping between ETH and a Pendle market token. Accepts either token address or token name (e.g. "sENA PT", "PT-sENA-25SEP2025"). This tool automatically renders UI.',
  parameters: z.object({
    token_address: z
      .string()
      .describe('Token address or name (e.g. "0x..." or "sENA PT", "PT-sENA-25SEP2025")'),
    user_wallet_address: z.string().describe('User wallet address'),
    market_name: z.string().optional().describe('Optional market name for context'),
    amount_in_human: z.string().describe('Amount to swap in human readable format (e.g. "1.5")'),
    token_type: z.enum(['PT', 'YT']).describe('Token type: PT (Principal Token) or YT (Yield Token)'),
    direction: z.enum(['ethToToken', 'tokenToEth']).describe('Swap direction')
  }),
  execute: async (params, context: ToolContext) => {
    return {
      _uiDisplayTool: true,
      summary: 'Quote functionality temporarily disabled',
      data: { message: 'Quote tool under maintenance' }
    }
  }
})

export const pendleSwapTool = tool({
  description:
    'Execute a swap between ETH and a Pendle market token. This tool automatically renders UI.',
  parameters: z.object({
    token_address: z.string().describe('Token address or name'),
    user_wallet_address: z.string().describe('User wallet address'),
    direction: z.enum(['ethToToken', 'tokenToEth']).describe('Swap direction'),
    token_type: z.enum(['PT', 'YT']).describe('Token type: PT (Principal Token) or YT (Yield Token)'),
    amount_in_human: z.string().describe('Amount to swap in human readable format (e.g. "1.5")'),
    slippage: z.number().min(0.1).max(50).default(100).describe('Slippage tolerance in basis points')
  }),
  execute: async (params, context: ToolContext) => {
    return {
      _uiDisplayTool: true,
      summary: 'Swap functionality temporarily disabled',
      data: { message: 'Swap tool under maintenance' }
    }
  }
})

export const pendleRedeemQuoteTool = tool({
  description:
    'Get a quote for redeeming Pendle PT tokens to underlying assets. This tool automatically renders UI.',
  parameters: z.object({
    pt_address: z.string().describe('PT token address'),
    token_input_type: z.enum(['PT']).describe('Input token type (always PT for redeem)'),
    token_output_type: z.enum(['SY', 'PY']).describe('Output token type: SY or PY'),
    amount_in_human: z.string().describe('Amount to redeem in human readable format (e.g. "1.5")'),
    user_wallet_address: z.string().describe('User wallet address'),
    slippage: z.number().min(0.1).max(50).default(100).describe('Slippage tolerance in basis points')
  }),
  execute: async (params, context: ToolContext) => {
    return {
      _uiDisplayTool: true,
      summary: 'Redeem quote functionality temporarily disabled',
      data: { message: 'Redeem quote tool under maintenance' }
    }
  }
})

export const pendleMintQuoteTool = tool({
  description:
    'Get a quote for minting Pendle PT tokens from underlying assets. This tool automatically renders UI.',
  parameters: z.object({
    pt_address: z.string().describe('PT token address'),
    token_input_type: z.enum(['SY', 'PY']).describe('Input token type: SY or PY'),
    token_output_type: z.enum(['PT']).describe('Output token type (always PT for mint)'),
    amount_in_human: z.string().describe('Amount to mint in human readable format (e.g. "1.5")'),
    user_wallet_address: z.string().describe('User wallet address'),
    slippage: z.number().min(0.1).max(50).default(100).describe('Slippage tolerance in basis points')
  }),
  execute: async (params, context: ToolContext) => {
    return {
      _uiDisplayTool: true,
      summary: 'Mint quote functionality temporarily disabled',
      data: { message: 'Mint quote tool under maintenance' }
    }
  }
})

export const pendleRedeemTool = tool({
  description:
    'Execute redemption of Pendle PT tokens to underlying assets. This tool automatically renders UI.',
  parameters: z.object({
    pt_address: z.string().describe('PT token address'),
    token_input_type: z.enum(['PT']).describe('Input token type (always PT for redeem)'),
    token_output_type: z.enum(['SY', 'PY']).describe('Output token type: SY or PY'),
    amount_in_human: z.string().describe('Amount to redeem in human readable format (e.g. "1.5")'),
    user_wallet_address: z.string().describe('User wallet address'),
    slippage: z.number().min(0.1).max(50).default(100).describe('Slippage tolerance in basis points')
  }),
  execute: async (params, context: ToolContext) => {
    return {
      _uiDisplayTool: true,
      summary: 'Redeem functionality temporarily disabled',
      data: { message: 'Redeem tool under maintenance' }
    }
  }
})

export const pendleMintTool = tool({
  description:
    'Execute minting of Pendle PT tokens from underlying assets. This tool automatically renders UI.',
  parameters: z.object({
    pt_address: z.string().describe('PT token address'),
    token_input_type: z.enum(['SY', 'PY']).describe('Input token type: SY or PY'),
    token_output_type: z.enum(['PT']).describe('Output token type (always PT for mint)'),
    amount_in_human: z.string().describe('Amount to mint in human readable format (e.g. "1.5")'),
    user_wallet_address: z.string().describe('User wallet address'),
    slippage: z.number().min(0.1).max(50).default(100).describe('Slippage tolerance in basis points')
  }),
  execute: async (params, context: ToolContext) => {
    return {
      _uiDisplayTool: true,
      summary: 'Mint functionality temporarily disabled',
      data: { message: 'Mint tool under maintenance' }
    }
  }
})

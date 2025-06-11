import { tool } from 'ai'
import { z } from 'zod'
import { NetworkContext } from '../types/context'
import { TENDERLY_DEMO_CONFIG } from '../network/config'
import { getWalletBalances } from '../utils/wallet'

import { addBalanceVnet, ethToWei, REQUESTED_FUNDING_AMOUNT, TenderlyRpcResponse } from '../tenderly/fund'
import { addBalanceAnvilFork } from '../anvil-fork/fund'
import { TransactionResponse } from 'ethers'

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

export const fundWalletTool = tool({
  description: `Fund a wallet with ${REQUESTED_FUNDING_AMOUNT} ETH (only works in Demo mode)`,
  parameters: z.object({
    wallet_address: z.string()
      .describe('EVM wallet address to fund with 0.1 ETH')
  }),
  execute: async (params, context: ToolContext) => {
    const { wallet_address } = params;
    const networkContext = context?.networkContext;
    
    if (!networkContext) {
      return {
        _uiDisplayTool: true,
        summary: 'Cannot fund wallet: Missing network context',
        data: {
          success: false,
          message: 'Missing network context. Cannot determine if in demo mode.'
        }
      };
    }
    
    try {
      // Check if we're in demo mode using the isDemo property from the NetworkContext
      const isDemo = networkContext.isDemo;
      
      // Call the funding function
      const result = await fundUserWallet(wallet_address, isDemo);
      
      // Check for error in the result
      if ('error' in result) {
        return {
          _uiDisplayTool: true,
          summary: `Wallet funding failed: ${result.error}`,
          data: {
            success: false,
            message: result.error
          }
        };
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Successfully funded wallet with 0.1 ETH`,
        data: {
          success: true,
          message: 'Successfully funded wallet with 0.1 ETH',
          amount: '0.1 ETH',
          wallet: wallet_address
        }
      };
    } catch (error) {
      console.error('Error in fund wallet tool:', error);
      
      return {
        _uiDisplayTool: true,
        summary: 'Error funding wallet',
        data: {
          success: false,
          message: `Failed to fund wallet: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }
})

/**
 * Tool for the agent to fund a user's wallet with 0.1 ETH
 * This function only works in Demo VNet environment
 * 
 * @param walletAddress - The wallet address to fund
 * @param isDemo - Whether the current network is in demo mode
 * @returns Promise with the RPC response or an error
 */
export async function fundUserWallet(
  walletAddress: string,
  isDemo: boolean
): Promise<TenderlyRpcResponse | TransactionResponse | { error: string }> {
  // Check if we're in Demo VNet
  if (!isDemo) {
    return { 
      error: "Funding is only available in Demo environment" 
    };
  }

  try {
    // Convert requested funding amount to wei in hex format
    const fundAmount = ethToWei(REQUESTED_FUNDING_AMOUNT.toString());
    
    if (process.env.NEXT_PUBLIC_TEST_NET_ENV === "development" && TENDERLY_DEMO_CONFIG.rpcUrl.includes('tenderly')) {
      return await addBalanceVnet([walletAddress], fundAmount);
    } else {
      return await addBalanceAnvilFork(walletAddress, BigInt(fundAmount));
    }
  } catch (error) {
    console.error('Error funding user wallet:', error);
    return {
      error: `Failed to fund wallet: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}  
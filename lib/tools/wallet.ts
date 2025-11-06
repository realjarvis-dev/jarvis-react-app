import { tool } from 'ai'
import { z } from 'zod'
import { TENDERLY_DEMO_CONFIG } from '../network/config'
import { NetworkContext } from '../types/context'
import { getWalletBalances } from '../utils/wallet'

import { TransactionResponse } from 'ethers'
import { addBalanceAnvilFork } from '../anvil-fork/fund'
import { getUserId } from '../privy/client'
import { balanceChangePub } from '../pubsub/balance-change-pub'
import { addBalanceVnet, ethToWei, INITIAL_REWARD_AMOUNT, REQUESTED_FUNDING_AMOUNT, TenderlyRpcResponse } from '../tenderly/fund'
import { addBalanceTestnet } from '../testnet-faucet/fund'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
  isNewUser?: boolean
}

export const walletBalanceTool = tool({
  description: 'Get wallet balance information for all tokens or a specific token.',
  parameters: z.object({
    wallet_address: z.string().optional()
      .describe('Specific EVM wallet address to check, default to user\'s EVM wallet'),
    solana_wallet_address: z.string().optional()
      .describe('Specific Solana wallet address to check, default to user\'s Solana wallet'),
    token_symbol: z.string().optional()
      .describe('Specific token symbol to filter by (e.g., "ETH", "DAI", etc.)')
  }),
  execute: async (params, context: ToolContext) => {
    const { wallet_address, token_symbol, solana_wallet_address } = params;
    const networkContext = context?.networkContext;
    
    try {
      const walletBalances = await getWalletBalances(wallet_address, solana_wallet_address)
      
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
      
      // Return all tokens with network error information
      const allTokensData = {
        success: true,
        message: 'Retrieved wallet balances',
        tokens: walletBalances.tokens,
        filtered: false,
        networkErrors: walletBalances.networkErrors
      }
      
      const errorCount = walletBalances.networkErrors?.length || 0
      const summary = errorCount > 0 
        ? `Found ${walletBalances.tokens.length} tokens (${errorCount} network errors)`
        : `Found ${walletBalances.tokens.length} tokens in wallet`
      
      return {
        _uiDisplayTool: true,
        summary,
        data: allTokensData
      }
    } catch (error) {
      console.error('Error in wallet balance tool:', error)
      const rawMessage = error instanceof Error ? error.message : String(error)
      let userMessage = 'Failed to fetch wallet balances'
      // Provide actionable guidance for signed-out users
      if (rawMessage.includes('No wallets found')) {
        userMessage = 'You are not signed in. Please sign in to view your wallet balances.'
      }
      return {
        _uiDisplayTool: true,
        summary: userMessage,
        data: {
          success: false,
          message: userMessage,
          tokens: []
        }
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
    const isNewUser = context?.isNewUser;
    
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
      const isDemo = networkContext.isDemo;
      
      const shouldUseInitialReward = isNewUser === true;
      const result = await fundUserWallet(wallet_address, isDemo, shouldUseInitialReward);
      
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
      const userId = await getUserId()
      balanceChangePub(userId, [networkContext.config.id], isDemo || true)

      const fundingAmount = shouldUseInitialReward ? INITIAL_REWARD_AMOUNT : REQUESTED_FUNDING_AMOUNT;
      const isInitialReward = shouldUseInitialReward;
      
      return {
        _uiDisplayTool: true,
        summary: isInitialReward 
          ? `Congrats, you have been rewarded ${INITIAL_REWARD_AMOUNT} ETH on demo net!`
          : `Successfully funded wallet with ${REQUESTED_FUNDING_AMOUNT} ETH`,
        data: {
          success: true,
          message: isInitialReward 
            ? `Congrats, you have been rewarded ${INITIAL_REWARD_AMOUNT} ETH on demo net!`
            : `Successfully funded wallet with ${REQUESTED_FUNDING_AMOUNT} ETH`,
          amount: `${fundingAmount} ETH`,
          wallet: wallet_address,
          is_initial_reward: isInitialReward
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

export const initialWalletRewardTool = tool({
  description: `Grant initial wallet reward of ${INITIAL_REWARD_AMOUNT} ETH to new users (only works in Demo mode)`,
  parameters: z.object({
    wallet_address: z.string()
      .describe('EVM wallet address to reward with 1 ETH initial funding')
  }),
  execute: async (params, context: ToolContext) => {
    const { wallet_address } = params;
    const networkContext = context?.networkContext;
    const isNewUser = context?.isNewUser;
    
    if (!networkContext) {
      return {
        _uiDisplayTool: true,
        summary: 'Cannot grant reward: Missing network context',
        data: {
          success: false,
          message: 'Missing network context. Cannot determine if in demo mode.'
        }
      };
    }
    
    try {
      // Check if we're in demo mode using the isDemo property from the NetworkContext
      const isDemo = networkContext.isDemo;
      
      // Call the funding function with new user flag
      const result = await fundUserWallet(wallet_address, isDemo, true);
      
      // Check for error in the result
      if ('error' in result) {
        return {
          _uiDisplayTool: true,
          summary: `Initial reward failed: ${result.error}`,
          data: {
            success: false,
            message: result.error
          }
        };
      }
      const userId = await getUserId()
      balanceChangePub(userId, [networkContext.config.id], isDemo || true)

      return {
        _uiDisplayTool: true,
        summary: `Congrats, you have been rewarded ${INITIAL_REWARD_AMOUNT} ETH on demo net!`,
        data: {
          success: true,
          message: `Congrats, you have been rewarded ${INITIAL_REWARD_AMOUNT} ETH on demo net!`,
          amount: `${INITIAL_REWARD_AMOUNT} ETH`,
          wallet: wallet_address,
          is_initial_reward: true
        }
      };
    } catch (error) {
      console.error('Error in initial wallet reward tool:', error);
      
      return {
        _uiDisplayTool: true,
        summary: 'Error granting initial reward',
        data: {
          success: false,
          message: `Failed to grant initial reward: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }
})

/**
 * Tool for the agent to fund a user's wallet
 * This function only works in Demo VNet environment
 * New users get 1 ETH initial reward, existing users get 0.1 ETH incremental funding
 * 
 * @param walletAddress - The wallet address to fund
 * @param isDemo - Whether the current network is in demo mode
 * @param isNewUser - Whether this is a new user (gets 1 ETH) or existing user (gets 0.1 ETH)
 * @returns Promise with the RPC response or an error
 */
export async function fundUserWallet(
  walletAddress: string,
  isDemo: boolean,
  isNewUser: boolean = false
): Promise<TenderlyRpcResponse | TransactionResponse | { error: string }> {
  // Check if we're in Demo VNet
  if (!isDemo) {
    return { 
      error: "Funding is only available in Demo environment" 
    };
  }

  try {
    const fundingAmount = isNewUser ? INITIAL_REWARD_AMOUNT : REQUESTED_FUNDING_AMOUNT;
    const fundAmount = ethToWei(fundingAmount.toString());
    
    console.log(`Funding wallet ${walletAddress} with ${fundingAmount} ETH (${isNewUser ? 'initial reward' : 'incremental funding'})`);
    
    // Decide funding mechanism based on environment:
    // - Local fork (anvil): use preset anvil accounts
    // - Hosted Tenderly (dev only): use Tenderly VNet
    // - Public testnet (Sepolia): use faucet private key
    const rpcUrl = TENDERLY_DEMO_CONFIG.rpcUrl || '';
    const isLocalFork = rpcUrl.includes('127.0.0.1') || rpcUrl.includes('anvil-fork');
    const isTenderlyVnet = rpcUrl.includes('tenderly');
    
    let result;
    if (isLocalFork) {
      // Local anvil fork
      result = await addBalanceAnvilFork(walletAddress, BigInt(fundAmount));
    } else if (isTenderlyVnet && process.env.NEXT_PUBLIC_TEST_NET_ENV === 'development') {
      // Legacy Tenderly VNet path (dev only)
      result = await addBalanceVnet([walletAddress], fundAmount);
    } else {
      // Public testnet (Sepolia) via faucet private key
      result = await addBalanceTestnet(walletAddress, BigInt(fundAmount));
    }
    return result;
  } catch (error) {
    console.error('Error funding user wallet:', error);
    return {
      error: `Failed to fund wallet: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

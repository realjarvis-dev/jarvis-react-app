import { tool } from 'ai'
import { ethers } from 'ethers'
import { z } from 'zod'
import { getPendleMarkets } from '../pendle/api'
import { getQuote } from '../pendle/quotes'
import {
  erc20Approval,
  executeSwapTransaction,
  getERC20Details,
  getSwapTransactionFromPendle
} from '../pendle/transactions'
import { getUserEvmWalletAddress } from '../privy/client'
import { NetworkContext } from '../types/context'
import { getConfigByChainId } from '../network/config'

// ETH address constants
const ETH_ADDRESS_IDENTIFIER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const ETH_ADDRESS_PENDLE = '0x0000000000000000000000000000000000000000'
const ETH_SYMBOL_IDENTIFIER = 'ETH'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const pendleOpportunitiesTool = tool({
  description:
    'Get Pendle yield opportunities on Ethereum. This tool automatically renders UI.',
  parameters: z.object({
    max_results: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe('Number of opportunities to return (default 10)'),
    apy_gte: z
      .number()
      .optional()
      .describe(
        'Minimum APY in percentage (e.g., 7 for 7%). Filters for APY >= value/100. Optional.'
      ),
    apy_lte: z
      .number()
      .optional()
      .describe(
        'Maximum APY in percentage (e.g., 10 for 10%). Filters for APY <= value/100. Optional.'
      )
  }),
  execute: async (params, context: ToolContext) => {
    const { max_results, apy_gte, apy_lte } = params;
    const networkContext = context?.networkContext;
    
    try {
      const markets = await getPendleMarkets()

      // Convert percentage inputs to decimals if they are provided
      let decimal_apy_gte = undefined
      if (typeof apy_gte === 'number') {
        decimal_apy_gte = apy_gte / 100
      }

      let decimal_apy_lte = undefined
      if (typeof apy_lte === 'number') {
        decimal_apy_lte = apy_lte / 100
      }

      // console.log(max_results, `original apy_gte: ${apy_gte}, converted: ${decimal_apy_gte}`, `original apy_lte: ${apy_lte}, converted: ${decimal_apy_lte}`);

      let filtered = markets
      if (decimal_apy_gte !== undefined)
        filtered = filtered.filter(o => o.impliedApy >= decimal_apy_gte!)
      if (decimal_apy_lte !== undefined)
        filtered = filtered.filter(o => o.impliedApy <= decimal_apy_lte!)
      filtered.sort((a, b) => b.impliedApy - a.impliedApy)
      const results = filtered.slice(0, max_results)
      
      // Return minimal data for streaming, but include full data for UI
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

export const pendleQuoteTool = tool({
  description:
    'Get a quote for swapping between ETH and a Pendle market token. This tool automatically renders UI.',
  parameters: z.object({
    token_address: z.string().describe('The address of the PT or YT token. The market will be automatically determined from this token.'),
    market_name: z
      .string()
      .describe('The name of the market (required, e.g. "rswETH")'),
    amount_in_human: z
      .string()
      .describe(
        'Amount of input token to swap in human-readable format (e.g., "1", "100.5"). Default to 1'
    ),
    token_type: z
      .enum(['pt', 'yt'])
      .default('pt')
      .describe(
        'The token type - "pt" for Principal Token or "yt" for Yield Token. Default to pt as only pt trading is available now.'
      ),
    direction: z
      .enum(['ethToToken', 'tokenToEth'])
      .default('ethToToken')
      .describe('Direction of the swap - from ETH to token or from token to ETH')
  }),
  execute: async (params, context: ToolContext) => {
    const {
      token_address,
      market_name,
      amount_in_human,
      token_type,
      direction
    } = params;
    const networkContext = context?.networkContext;
    
    try {
      console.log('===== PENDLE QUOTE TOOL DEBUG =====');
      console.log('Input parameters:', {
        token_address,
        market_name,
        token_type,
        direction
      });
      
      if (!token_address) {
        throw new Error('Token address must be provided');
      }
      
      // Always get market address from token address
      console.log('Searching for market using token address:', token_address);
      const markets = await getPendleMarkets();
      console.log('Available markets count:', markets.length);
      
      // Find market that contains the token
      const foundMarket = markets.find(market => {
        const addressToCheck = token_type === 'pt' ? market.pt : market.yt;
        const matches = addressToCheck.toLowerCase() === token_address.toLowerCase();
        if (matches) {
          console.log('Found matching market:', {
            name: market.name,
            address: market.address,
            pt: market.pt,
            yt: market.yt
          });
        }
        return matches;
      });
      
      if (!foundMarket) {
        throw new Error(`Could not find a Pendle market with ${token_type.toUpperCase()} token address ${token_address}`);
      }
      
      const finalMarketAddress = foundMarket.address;
      const finalTokenAddress = token_address;

      // Format full token name with PT/YT prefix
      const fullTokenName = `${token_type.toUpperCase()} ${market_name}`
      
      // Call the getQuote function with the direction parameter
      const quote = await getQuote(
        finalMarketAddress.toLowerCase().trim(),
        finalTokenAddress.toLowerCase().trim(),
        fullTokenName,
        amount_in_human, // Fixed amount of 1 ETH or token
        direction, // Direction of the swap
        1 // Fixed chain ID (Ethereum)
      )

      // Return a clean response object with minimal streaming data
      // Use the new response format from our updated getQuote function
      const quoteData = {
        market: fullTokenName,
        inputAmount: amount_in_human,
        inputToken: quote.inputToken,
        outputToken: quote.outputToken,
        rate: quote.rate,
        inverse: quote.inverse,
        outputAmount: quote.outputAmount,
        complete_time: new Date().toISOString(),
        foundMarketAddress: finalMarketAddress,
        foundTokenAddress: finalTokenAddress
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Quote for ${quote.rate}`,
        data: quoteData
      }
    } catch (error: any) {
      // Return a simple error object
      const errorData = {
        error: error.message || 'Failed to get quote',
        token_address
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Error getting quote: ${error.message || 'Failed to get quote'}`,
        data: errorData
      }
    }
  }
})

export const pendleSwapTool = tool({
  description:
    `Execute a swap transaction between ETH and a Pendle token (PT/YT).
    Provide the token address and direction to swap.
    This tool automatically renders UI.`,
  parameters: z.object({
    token_address: z
      .string()
      .describe('The address of the PT or YT token. The market will be automatically determined from this token.'),
    direction: z
      .enum(['ethToToken', 'tokenToEth'])
      .default('ethToToken')
      .describe('Direction of the swap - from ETH to token or from token to ETH'),
    token_type: z
      .enum(['pt', 'yt'])
      .default('pt')
      .describe(
        'The token type - "pt" for Principal Token or "yt" for Yield Token. Default to pt.'
      ),
    amount_in_human: z
      .string()
      .describe(
        'Amount of input token to swap in human-readable format (e.g., "1", "100.5").'
      ),
    slippage: z
      .number()
      .min(0.001)
      .max(0.1)
      .default(0.01)
      .describe('Maximum acceptable slippage (default: 0.01, which is 1%).'),
    market_name: z
      .string()
      .optional()
      .describe('The name of the market (e.g. "rswETH"). Used for display purposes.')
  }),
  execute: async (params, context: ToolContext) => {
    let {
      token_address,
      direction,
      token_type,
      amount_in_human,
      slippage = 0.01,
      market_name
    } = params;
    const networkContext = context?.networkContext;
    const isDemo = networkContext?.isDemo
    if (isDemo) {
      slippage = 0.01
    }

    let input_token_address, output_token_address;
    let displayTokenIn, displayTokenOut;
    try {
      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        throw new Error(
          'EVM wallet address not found. Please connect your wallet.'
        )
      }

      const chainId = networkContext?.selectedChainId
      const isDemo = networkContext!.isDemo

      console.log('===== PENDLE SWAP TOOL DEBUG =====');
      console.log('Input parameters:', {
        token_address,
        direction,
        token_type,
        amount_in_human,
        slippage
      });
      
      if (!token_address) {
        throw new Error('Token address must be provided');
      }
      
      // Find market that contains the token
      console.log('Searching for market using token address:', token_address);
      const markets = await getPendleMarkets();
      console.log('Available markets count:', markets.length);
      
      const foundMarket = markets.find(market => {
        const addressToCheck = token_type === 'pt' ? market.pt : market.yt;
        const matches = addressToCheck.toLowerCase() === token_address.toLowerCase();
        if (matches) {
          console.log('Found matching market:', {
            name: market.name,
            address: market.address,
            pt: market.pt,
            yt: market.yt
          });
        }
        return matches;
      });
      
      if (!foundMarket) {
        throw new Error(`Could not find a Pendle market with ${token_type.toUpperCase()} token address ${token_address}`);
      }
      
      const market_address = foundMarket.address;
      const tokenSymbol = market_name || foundMarket.name;
      const fullTokenName = `${token_type.toUpperCase()} ${tokenSymbol}`;

      // Determine input and output tokens based on direction

      
      if (direction === 'ethToToken') {
        input_token_address = ETH_ADDRESS_PENDLE;
        output_token_address = token_address;
        displayTokenIn = ETH_SYMBOL_IDENTIFIER;
        displayTokenOut = fullTokenName;
      } else { // tokenToEth
        input_token_address = token_address;
        output_token_address = ETH_ADDRESS_PENDLE;
        displayTokenIn = fullTokenName;
        displayTokenOut = ETH_SYMBOL_IDENTIFIER;
      }

      let amountInBaseUnits: string;
      const isInputETH = direction === 'ethToToken';

      if (isInputETH) {
        try {
          amountInBaseUnits = ethers.parseEther(amount_in_human).toString()
        } catch (error) {
          throw new Error(
            `Invalid ETH amount: ${amount_in_human}. ${
              (error as Error).message
            }`
          )
        }
      } else {
        // ERC20 input (e.g., PT/YT token)
          try {
            const tokenDetails = await getERC20Details(
              input_token_address,
              chainId
            )
            amountInBaseUnits = ethers
              .parseUnits(amount_in_human, tokenDetails.decimals)
              .toString()
          } catch (error: any) {
            throw new Error(
              `Failed to get details or parse amount for input token ${input_token_address}: ${error.message}`
            )
          }
      }

      const txData = await getSwapTransactionFromPendle(
        market_address.toLowerCase().trim(),
        input_token_address,
        output_token_address,
        amountInBaseUnits,
        slippage
      )
      if (!txData) {
        throw new Error('Failed to prepare transaction data using Pendle.')
      }

      // For ERC20 inputs, handle approval first
      if (!isInputETH) {
        const spenderAddress = txData.to
        const approvalResult = await erc20Approval(
          input_token_address,
          spenderAddress,
          amountInBaseUnits,
          evmWalletAddress,
          chainId,
          isDemo
        )
        if (approvalResult.status === 'fail') {
          throw new Error(
            `ERC20 approval failed for token ${input_token_address} to spender ${spenderAddress}: ${approvalResult.message}`
          )
        }
      } 

      // Execute the transaction
      const result = await executeSwapTransaction(txData, chainId, {estimateGas: true}, isDemo)
      const explorerLink = getConfigByChainId(chainId!, isDemo).scanLink
      const explorerLinkWithHash = `https://${explorerLink}/tx/${result.hash}`

      const swapData = {
        success: true,
        transaction_hash: result.hash,
        swap_details: {
          from: displayTokenIn,
          to: displayTokenOut,
          amount_in: `${amount_in_human} ${displayTokenIn}`,
          direction: direction,
          token_address: token_address,
          complete_time: new Date().toISOString(),
          chainId: chainId,
          explorer_link: explorerLink ? explorerLinkWithHash : undefined
        }
      }

      return {
        _uiDisplayTool: true,
        summary: `Swap executed: ${amount_in_human} ${displayTokenIn} → ${displayTokenOut}`,
        data: swapData
      }
    } catch (error: any) {
      console.log(error)
      const errorData = {
        success: false,
        error: error.message || 'Failed to execute Pendle swap.',
        swap_parameters: {
          from: displayTokenIn,
          to: displayTokenOut,
          amount_in: `${amount_in_human} ${displayTokenIn}`,
          input_token_address: input_token_address,
          output_token_address: output_token_address,
          token_address,
          direction,
          amount_in_human,
          slippage
        }
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Swap failed: ${error.message || 'Failed to execute Pendle swap'}`,
        data: errorData
      }
    }
  }
})

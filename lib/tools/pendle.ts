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
    'Get a quote for swapping ETH to a Pendle market token. This tool automatically renders UI.',
  parameters: z.object({
    market_address: z.string().describe('The address of the Pendle market'),
    token_out_address: z
      .string()
      .describe('The address of the token to receive (PT or YT)'),
    market_name: z
      .string()
      .describe('The name of the market (required, e.g. "rswETH")'),
    token_type: z
      .enum(['pt', 'yt'])
      .default('pt')
      .describe(
        'The token type - "pt" for Principal Token or "yt" for Yield Token. Default to pt as only pt trading is available now.'
      )
  }),
  execute: async (params, context: ToolContext) => {
    const {
      market_address,
      token_out_address,
      market_name,
      token_type
    } = params;
    const networkContext = context?.networkContext;
    
    try {
      // Format full token name with PT/YT prefix
      const fullTokenName = `${token_type.toUpperCase()} ${market_name}`

      // Call the getQuote function with fixed parameters for simplicity
      const quote = await getQuote(
        market_address.toLowerCase().trim(),
        token_out_address.toLowerCase().trim(),
        fullTokenName, // Pass the properly formatted token name
        '1', // Fixed amount of 1 ETH
        1 // Fixed chain ID (Ethereum)
      )

      // Return a clean response object with minimal streaming data
      const quoteData = {
        market: fullTokenName,
        rate: quote.rate,
        inverse_rate: quote.inverse,
        output_amount: quote.outputAmount,
        complete_time: new Date().toISOString()
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Quote for ${fullTokenName}: ${quote.rate}`,
        data: quoteData
      }
    } catch (error: any) {
      // Return a simple error object
      const errorData = {
        error: error.message || 'Failed to get quote',
        market_address,
        token_out_address
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
    `Execute a swap transaction between ETH and a Pendle PT token (e.g. ETH to PT, or PT to ETH).
    You need to retrieve the relevant token address and market address from pendle_opportunities tool before calling this.
    This tool automatically renders UI.`,
  parameters: z.object({
    market_address: z
      .string()
      .describe('The address of the Pendle market'),
    input_token_address: z
      .string()
      .describe(
        'Address of the token to swap from. Use "ETH" or its zero address (0xeeee...) for native Ether, or the PT token address.'
      ),
    output_token_address: z
      .string()
      .describe(
        'Address of the token to swap to. Use "ETH" or its zero address (0xeeee...) for native Ether, or the PT token address.'
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
    input_token_name_display: z
      .string()
      .optional()
      .describe(
        'Display name for the input token (e.g., "ETH", "PT eETH"). If not provided, a generic name or address will be used.'
      ),
    output_token_name_display: z
      .string()
      .optional()
      .describe(
        'Display name for the output token (e.g., "PT eETH", "ETH"). If not provided, a generic name or address will be used.'
      )
  }),
  execute: async (params, context: ToolContext) => {
    const {
      market_address,
      input_token_address,
      output_token_address,
      amount_in_human,
      slippage = 0.01,
      input_token_name_display,
      output_token_name_display
    } = params;
    const networkContext = context?.networkContext;
    
    try {
      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        throw new Error(
          'EVM wallet address not found. Please connect your wallet.'
        )
      }

      const chainId = 1 // Assuming Ethereum mainnet for Pendle

      let actualTokenInAddress = input_token_address.toLowerCase().trim()
      let actualTokenOutAddress = output_token_address.toLowerCase().trim()
      let displayTokenIn: string
      let displayTokenOut: string

      const isInputETHRaw =
        actualTokenInAddress.toUpperCase() === ETH_SYMBOL_IDENTIFIER ||
        actualTokenInAddress === ETH_ADDRESS_IDENTIFIER
      const isOutputETHRaw =
        actualTokenOutAddress.toUpperCase() === ETH_SYMBOL_IDENTIFIER ||
        actualTokenOutAddress === ETH_ADDRESS_IDENTIFIER

      if (isInputETHRaw) {
        actualTokenInAddress = ETH_ADDRESS_PENDLE
        displayTokenIn = input_token_name_display || ETH_SYMBOL_IDENTIFIER
      } else {
        actualTokenInAddress = ethers.getAddress(actualTokenInAddress) // Validate/checksum
        displayTokenIn =
          input_token_name_display || `${actualTokenInAddress.slice(0, 6)}...`
      }

      if (isOutputETHRaw) {
        actualTokenOutAddress = ETH_ADDRESS_PENDLE
        displayTokenOut = output_token_name_display || ETH_SYMBOL_IDENTIFIER
      } else {
        actualTokenOutAddress = ethers.getAddress(actualTokenOutAddress) // Validate/checksum
        displayTokenOut =
          output_token_name_display || `${actualTokenOutAddress.slice(0, 6)}...`
      }

      const isInputProcessedETH =
        actualTokenInAddress === ETH_ADDRESS_PENDLE
      let amountInBaseUnits: string

      if (isInputProcessedETH) {
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
        // ERC20 input (e.g., PT token)
          try {
            const tokenDetails = await getERC20Details(
              actualTokenInAddress,
              chainId
            )
            amountInBaseUnits = ethers
              .parseUnits(amount_in_human, tokenDetails.decimals)
              .toString()
          } catch (error: any) {
            throw new Error(
              `Failed to get details or parse amount for input token ${actualTokenInAddress}: ${error.message}`
            )
          }
      }

      const txData = await getSwapTransactionFromPendle(
        market_address.toLowerCase().trim(),
        actualTokenInAddress,
        actualTokenOutAddress,
        amountInBaseUnits,
        slippage
      )
      if (!txData) {
        throw new Error('Failed to prepare transaction data using Pendle.')
      }

      // For ERC20 inputs, handle approval first using the spender from ensoSwap's initial call
      if (!isInputProcessedETH) {
        const spenderAddress = txData.to

        const approvalResult = await erc20Approval(
          actualTokenInAddress,
          spenderAddress,
          amountInBaseUnits,
          evmWalletAddress,
          chainId
        )
        if (approvalResult.status === 'fail') {
          throw new Error(
            `ERC20 approval failed for token ${actualTokenInAddress} to spender ${spenderAddress}: ${approvalResult.message}`
          )
        }
      } 

      // Execute the transaction
      const result = await executeSwapTransaction(txData, chainId)

      const swapData = {
        success: true,
        transaction_hash: result.hash,
        swap_details: {
          from: displayTokenIn,
          to: displayTokenOut,
          amount_in: `${amount_in_human} ${displayTokenIn}`,
          input_token_address: actualTokenInAddress,
          output_token_address: actualTokenOutAddress,
          complete_time: new Date().toISOString()
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
          input_token_address: input_token_address,
          output_token_address: output_token_address,
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

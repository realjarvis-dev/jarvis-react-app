import { tool } from 'ai'
import { ethers } from 'ethers'
import { z } from 'zod'
import { getPendleMarkets } from '../pendle/api'
import { getQuote } from '../pendle/quotes'
import {
  executeSwapTransaction,
  getSwapEthToTokenTransaction
} from '../pendle/transactions'
import { ensoSwapEthToToken } from '../enso/swap'
import { getUserEvmWalletAddress } from '../privy/client'

export const pendleOpportunitiesTool = tool({
  description: 'Get Pendle yield opportunities on Ethereum. This tool automatically renders UI.',
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
  execute: async ({ max_results = 10, apy_gte, apy_lte }) => {
    const all = await getPendleMarkets()
    // console.log(max_results, apy_gte, apy_lte) // Original log
    // console.log(all)

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

    let filtered = all
    if (decimal_apy_gte !== undefined)
      filtered = filtered.filter(o => o.impliedApy >= decimal_apy_gte!)
    if (decimal_apy_lte !== undefined)
      filtered = filtered.filter(o => o.impliedApy <= decimal_apy_lte!)
    filtered.sort((a, b) => b.impliedApy - a.impliedApy)
    return filtered.slice(0, max_results)
  }
})

export const pendleQuoteTool = tool({
  description: 'Get a quote for swapping ETH to a Pendle market token. This tool automatically renders UI.',
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
  execute: async ({
    market_address,
    token_out_address,
    market_name,
    token_type
  }) => {
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

      // Return a clean response object
      return {
        market: fullTokenName,
        rate: quote.rate,
        inverse_rate: quote.inverse,
        output_amount: quote.outputAmount,
        complete_time: new Date().toISOString()
      }
    } catch (error: any) {
      // Return a simple error object
      return {
        error: error.message || 'Failed to get quote',
        market_address,
        token_out_address
      }
    }
  }
})

export const pendleSwapTool = tool({
  description:
    'Execute a swap transaction from ETH to a Pendle token (PT only). This tool automatically renders UI.',
  parameters: z.object({
    // market_address: z.string().describe('The address of the Pendle market'),
    token_out_address: z
      .string()
      .describe('The address of the token to receive (PT only)'),
    amount_in_eth: z
      .string()
      .describe('Amount of ETH to swap (in ETH units, e.g. "1" for 1 ETH)'),
    slippage: z
      .number()
      .min(0.001)
      .max(0.1)
      .default(0.01)
      .describe('Maximum acceptable slippage (default: 0.01 which is 1%)'),
    token_name: z
      .string()
      .optional()
      .describe('The name of the token to receive (e.g. "PT weETH")')
  }),
  execute: async ({
    // market_address,
    token_out_address,
    amount_in_eth,
    slippage = 0.01,
    token_name
  }) => {
    try {
      // Convert ETH amount to wei
      let amountInWei
      try {
        amountInWei = ethers.parseEther(amount_in_eth).toString()
      } catch (error) {
        throw new Error(`Invalid ETH amount: ${amount_in_eth}`)
      }

      // // // Get the transaction data
      // const txData = await getSwapEthToTokenTransaction(
      //   market_address.toLowerCase().trim(),
      //   token_out_address.toLowerCase().trim(),
      //   amountInWei,
      //   slippage
      // )

      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        throw new Error('EVM wallet not found')
      }


      const txData = await ensoSwapEthToToken({
        tokenOut: token_out_address.toLowerCase().trim(),
        fromAddress: evmWalletAddress,
        amountIn: amountInWei,
        slippage
      })


      // Execute the transaction
      const result = await executeSwapTransaction(txData)

      // Determine token type (PT or YT) from the token_out_address
      const isYT = token_out_address.toLowerCase().includes('yt')

      // Use provided token name or generate a generic one
      const tokenDisplay = token_name || (isYT ? 'YT Token' : 'PT Token')

      // Return a clean response object
      return {
        success: true,
        transaction_hash: result.hash,
        swap_details: {
          from: 'ETH',
          to: tokenDisplay,
          amount: amount_in_eth + ' ETH',
          // market: market_address
          complete_time: new Date().toISOString()
        }
      }
    } catch (error: any) {
      // Return a simple error object
      return {
        success: false,
        error: error.message || 'Failed to execute swap',
        // market_address,
        token_out_address
      }
    }
  }
})

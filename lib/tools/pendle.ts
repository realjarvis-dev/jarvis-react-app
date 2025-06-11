import { tool } from 'ai'
import { ethers } from 'ethers'
import { z } from 'zod'
import { getPendleMarkets } from '../pendle/api'
import { getQuote } from '../pendle/quotes'
import {
  erc20Approval,
  executeRedeemInterestsAndRewardsTransaction,
  executeRedeemTransaction,
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
    'Get a quote for swapping between ETH and a Pendle market token. This tool automatically renders UI.',
  parameters: z.object({
    token_address: z.string().describe('The address of the PT or YT token. The market will be automatically determined from this token.'),
    market_name: z
      .string()
      .describe('The name of the market (required, e.g. "rswETH")'),
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
        '1', // Fixed amount of 1 ETH or token
        direction, // Direction of the swap
        1 // Fixed chain ID (Ethereum)
      )

      // Return a clean response object with minimal streaming data
      // Use the new response format from our updated getQuote function
      const quoteData = {
        market: fullTokenName,
        inputToken: quote.inputToken,
        outputToken: quote.outputToken,
        rate: quote.rate,
        inverse: quote.inverse,
        outputAmount: quote.outputAmount,
        complete_time: new Date().toISOString()
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
    const isDemo = networkContext?.isDemo
    
    try {
      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        throw new Error(
          'EVM wallet address not found. Please connect your wallet.'
        )
      }

      const chainId = networkContext?.selectedChainId // Assuming Ethereum mainnet for Pendle
      const isDemo = networkContext!.isDemo

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
          chainId,
          isDemo
        )
        if (approvalResult.status === 'fail') {
          throw new Error(
            `ERC20 approval failed for token ${actualTokenInAddress} to spender ${spenderAddress}: ${approvalResult.message}`
          )
        }
      } 

      // Execute the transaction
      const result = await executeSwapTransaction(txData, chainId, {estimateGas: true}, isDemo)

      const swapData = {
        success: true,
        transaction_hash: result.hash,
        swap_details: {
          from: displayTokenIn,
          to: displayTokenOut,
          amount_in: `${amount_in_human} ${displayTokenIn}`,
          input_token_address: actualTokenInAddress,
          output_token_address: actualTokenOutAddress,
          complete_time: new Date().toISOString(),
          chainId: chainId
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

export const pendleRedeemPTTool = tool({
  description:
    `Redeem Pendle PT & YT tokens to ETH. If called before YT's expiry, both PT & YT of equal amounts 
    are needed and will be burned. After expiry, only PT is needed and will be burned.
    This tool automatically renders UI.`,
  parameters: z.object({
    pt_address: z
      .string()
      .describe('The address of the PT (Principal Token) to redeem'),
    amount_in_human: z
      .string()
      .describe(
        'Amount of tokens to redeem in human-readable format (e.g., "1", "100.5"). If the amount is not provided by the user, use the user\'s current balance of the token.'
      ),
    token_name_display: z
      .string()
      .optional()
      .describe(
        'Display name for the token (e.g., "PT rswETH"). If not provided, a generic name or address will be used.'
      ),
    slippage: z
      .number()
      .min(0.001)
      .max(0.1)
      .default(0.01)
      .describe('Maximum acceptable slippage (default: 0.01, which is 1%).')
  }),
  execute: async (params, context: ToolContext) => {
    const {
      pt_address,
      amount_in_human,
      token_name_display,
      slippage = 0.01
    } = params;
    const networkContext = context?.networkContext;
    const isDemo = networkContext?.isDemo
    
    try {
      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        throw new Error(
          'EVM wallet address not found. Please connect your wallet.'
        )
      }

      const chainId = networkContext?.selectedChainId || 1 // Default to Ethereum mainnet
      
      // Find the market using the PT token address to get the corresponding YT token
      const markets = await getPendleMarkets('all');
      
      // Find market that contains the PT token
      const foundMarket = markets.find(market => {
        return market.pt.toLowerCase() === pt_address.toLowerCase();
      });
      
      if (!foundMarket) {
        throw new Error(`Could not find a Pendle market with PT token address ${pt_address}`);
      }
      
      // Get the YT token address from the found market
      const ytAddress = foundMarket.yt;
      
      // Use the market name for display if no name provided
      const displayTokenName = token_name_display || `PT ${foundMarket.name}`

      // Get token details to convert human amount to base units
      let amountInBaseUnits: string
      try {
        // Try to get token details first
        try {
          const tokenAddress = ethers.getAddress(pt_address.trim())
          const tokenDetails = await getERC20Details(tokenAddress, chainId)
          
          // Parse the amount with the correct number of decimals
          const amountBigInt = ethers.parseUnits(amount_in_human, tokenDetails.decimals)
          // Ensure we have a clean string representation without scientific notation
          amountInBaseUnits = amountBigInt.toString()
        } catch (tokenError: any) {
          // Fallback to 18 decimals (most common) if token details can't be fetched
          console.log(`Could not get token details, using default 18 decimals: ${tokenError.message}`)
          
          // For expired tokens, default to 18 decimals (standard for most ERC20 tokens)
          const amountBigInt = ethers.parseUnits(amount_in_human, 18)
          amountInBaseUnits = amountBigInt.toString()
        }
      } catch (error: any) {
        throw new Error(
          `Failed to parse amount for PT token: ${error.message}`
        )
      }

      // Normalize the YT address
      const normalizedYtAddress = ytAddress.trim().toLowerCase()
      
      // Execute the redeem transaction using the YT address
      const result = await executeRedeemTransaction(
        normalizedYtAddress,
        amountInBaseUnits,
        slippage,
        chainId,
        false, // enableAggregator
        isDemo
      )

      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to execute redemption')
      }

      const redeemData = {
        success: true,
        transaction_hash: result.hash,
        redeem_details: {
          token: displayTokenName,
          amount_in: `${amount_in_human} ${displayTokenName}`,
          amount_out: result.amountOut,
          complete_time: new Date().toISOString(),
          chainId: chainId
        }
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Redemption executed: ${amount_in_human} ${displayTokenName} → ETH`,
        data: redeemData
      }
    } catch (error: any) {
      const errorData = {
        success: false,
        error: error.message || 'Failed to execute Pendle redemption.',
        redeem_parameters: {
          pt_address,
          amount_in_human,
          slippage
        }
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Redemption failed: ${error.message || 'Failed to execute Pendle redemption'}`,
        data: errorData
      }
    }
  }
})

export const pendleRedeemYTTool = tool({
  description:
    `Redeem accrued rewards and interests from Pendle YT positions after expiry.
    Before expiry, YT cannot be redeemed through this tool. This tool automatically renders UI.`,
  parameters: z.object({
    yt_addresses: z
      .array(z.string())
      .describe('Array of YT (Yield Token) addresses to redeem rewards from.')
  }),
  execute: async (params, context: ToolContext) => {
    const {
      yt_addresses
    } = params;
    const networkContext = context?.networkContext;
    const isDemo = networkContext?.isDemo
    
    try {
      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        throw new Error(
          'EVM wallet address not found. Please connect your wallet.'
        )
      }

      const chainId = networkContext?.selectedChainId || 1 // Default to Ethereum mainnet

      // Check if YT addresses array has items
      if (!yt_addresses || yt_addresses.length === 0) {
        throw new Error('YT addresses array must contain at least one address')
      }

      // Process addresses to ensure they're properly formatted
      const processedYtAddresses = yt_addresses.map(addr => addr.trim());
      
      // Define empty arrays for market_addresses and sy_addresses as placeholders for future
      const processedMarketAddresses: string[] = []
      const processedSyAddresses: string[] = []

      // Execute the redemption transaction
      const result = await executeRedeemInterestsAndRewardsTransaction(
        processedSyAddresses.length > 0 ? processedSyAddresses : undefined,
        processedYtAddresses,
        processedMarketAddresses.length > 0 ? processedMarketAddresses : undefined,
        chainId,
        isDemo
      )
      
      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to redeem rewards')
      }

      const redeemData = {
        success: true,
        transaction_hash: result.hash,
        redeem_details: {
          yts: processedYtAddresses,
          complete_time: new Date().toISOString(),
          chainId: chainId
        }
      }
      
      return {
        _uiDisplayTool: true,
        summary: `YT rewards redemption executed successfully`,
        data: redeemData
      }
    } catch (error: any) {
      const errorData = {
        success: false,
        error: error.message || 'Failed to redeem Pendle YT rewards.',
        redeem_parameters: {
          yt_addresses
        }
      }
      
      return {
        _uiDisplayTool: true,
        summary: `YT rewards redemption failed: ${error.message || 'Failed to redeem Pendle YT rewards'}`,
        data: errorData
      }
    }
  }
})

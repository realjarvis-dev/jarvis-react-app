import { tool } from 'ai'
import { ethers } from 'ethers'
import { z } from 'zod'
import { getConfigByChainId } from '../network/config'
import { getPendleMarkets } from '../pendle/api'
import { executePendleSwap, getSwapQuote } from '../pendle/swap'
import {
  executeRedeemInterestsAndRewardsTransaction,
  executeRedeemTransaction,
  getERC20Details
} from '../pendle/transactions'
import { getUserEvmWalletAddress } from '../privy/client'
import { NetworkContext } from '../types/context'


const PENDLE_CONFIG = {
  // Ethereum Address Constants
  ETH_ADDRESS_IDENTIFIER: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ETH_ADDRESS_PENDLE: '0x0000000000000000000000000000000000000000',
  ETH_SYMBOL: 'ETH',
  
  // Slippage Configuration
  DEFAULT_SLIPPAGE: 0.01,        // 1% default slippage
  DEMO_SLIPPAGE: 0.3,            // 30% slippage for demo mode
  MAX_SLIPPAGE: 0.1,             // 10% maximum allowed slippage
  MIN_SLIPPAGE: 0.001,           // 0.1% minimum slippage
  
  // Chain and Decimals
  DEFAULT_CHAIN_ID: 1,           // Ethereum mainnet
  DEFAULT_DECIMALS: 18,          // Standard ERC20 decimals
  
  // Rate Display Configuration
  INVERSE_RATE_PRECISION: 6,     // Number of decimal places for inverse rate display
  
  // Tool Result Limits
  MAX_OPPORTUNITIES: 50,         // Maximum opportunities to return
  MIN_OPPORTUNITIES: 1,          // Minimum opportunities to return
  DEFAULT_OPPORTUNITIES: 10,     // Default number of opportunities
  
  // Aggregator Settings
  ENABLE_AGGREGATOR: true,       // Enable swap aggregator by default
} as const;



interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

/**
 * Helper function to find a Pendle market by token address
 * @param tokenAddress The PT or YT token address to search for
 * @param tokenType The type of token - 'pt' or 'yt'
 * @returns The found market object
 * @throws Error if no market is found with the given token address
 */
async function findMarketByTokenAddress(tokenAddress: string, tokenType: 'pt' | 'yt') {
  if (!tokenAddress) {
    throw new Error('Token address must be provided');
  }
  
  const markets = await getPendleMarkets();
  
  const foundMarket = markets.find(market => {
    const addressToCheck = tokenType === 'pt' ? market.pt : market.yt;
    return addressToCheck.toLowerCase() === tokenAddress.toLowerCase();
  });
  
  if (!foundMarket) {
    throw new Error(`Could not find a Pendle market with ${tokenType.toUpperCase()} token address ${tokenAddress}`);
  }
  
  return foundMarket;
}

/**
 * Helper function to prepare swap configuration for Pendle operations
 * @param tokenAddress The PT or YT token address
 * @param tokenType The type of token - 'pt' or 'yt'
 * @param direction The swap direction - 'ethToToken' or 'tokenToEth'
 * @param amountHuman The human-readable amount to swap
 * @param marketName The market name for display purposes
 * @param chainId The chain ID to use for token details lookup
 * @returns Prepared swap configuration object
 */
async function prepareSwapConfiguration(
  tokenAddress: string,
  tokenType: 'pt' | 'yt',
  direction: 'ethToToken' | 'tokenToEth',
  amountHuman: string,
  marketName?: string,
  chainId?: number
) {
  // Find market that contains the token
  const foundMarket = await findMarketByTokenAddress(tokenAddress, tokenType);
  
  const marketAddress = foundMarket.address;
  const tokenSymbol = marketName || foundMarket.name;
  const fullTokenName = `${tokenType.toUpperCase()} ${tokenSymbol}`;

  // Determine tokenIn, tokenOut, and convert amount to wei
  let tokenIn: string;
  let tokenOut: string;
  let amountInWei: string;
  let inputToken: string;
  let outputToken: string;
  
  if (direction === 'ethToToken') {
    tokenIn = PENDLE_CONFIG.ETH_ADDRESS_PENDLE;
    tokenOut = tokenAddress;
    inputToken = PENDLE_CONFIG.ETH_SYMBOL;
    outputToken = fullTokenName;
    amountInWei = ethers.parseEther(amountHuman).toString();
  } else {
    tokenIn = tokenAddress;
    tokenOut = PENDLE_CONFIG.ETH_ADDRESS_PENDLE;
    inputToken = fullTokenName;
    outputToken = PENDLE_CONFIG.ETH_SYMBOL;
    
    // For token input, get token details to convert to wei
    try {
      const tokenDetails = await getERC20Details(tokenAddress, chainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID);
      amountInWei = ethers.parseUnits(amountHuman, tokenDetails.decimals).toString();
    } catch (error) {
      // Fallback to default decimals if token details can't be fetched
      amountInWei = ethers.parseUnits(amountHuman, PENDLE_CONFIG.DEFAULT_DECIMALS).toString();
    }
  }

  return {
    foundMarket,
    marketAddress,
    fullTokenName,
    tokenIn,
    tokenOut,
    amountInWei,
    inputToken,
    outputToken
  };
}

/**
 * Helper function to format swap output amounts and calculate rates
 * @param swapData The swap data from Pendle containing amountOut
 * @param direction The swap direction - 'ethToToken' or 'tokenToEth'
 * @param tokenAddress The token address for getting decimals
 * @param amountInHuman The human-readable input amount
 * @param inputToken The input token display name
 * @param outputToken The output token display name
 * @param chainId The chain ID for token details lookup
 * @returns Formatted output data with rates
 */
async function formatSwapOutput(
  swapData: any,
  direction: 'ethToToken' | 'tokenToEth',
  tokenAddress: string,
  amountInHuman: string,
  inputToken: string,
  outputToken: string,
  chainId?: number
) {
  // Format output amount based on output token
  let outputAmountFormatted: string;
  if (direction === 'ethToToken') {
    // Output is token, need to format with token decimals
    try {
      const tokenDetails = await getERC20Details(tokenAddress, chainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID);
      outputAmountFormatted = ethers.formatUnits(swapData.amountOut, tokenDetails.decimals);
    } catch (error) {
      // Fallback to default decimals
      outputAmountFormatted = ethers.formatUnits(swapData.amountOut, PENDLE_CONFIG.DEFAULT_DECIMALS);
    }
  } else {
    // Output is ETH
    outputAmountFormatted = ethers.formatEther(swapData.amountOut);
  }
  
  // Create rate string
  const rate = `${amountInHuman} ${inputToken} → ${outputAmountFormatted} ${outputToken}`;
  
  // Calculate inverse rate
  const inputAmount = parseFloat(amountInHuman);
  const outputAmount = parseFloat(outputAmountFormatted);
  const inverseRatio = inputAmount / outputAmount;
  const inverse = `1 ${outputToken} → ${inverseRatio.toFixed(PENDLE_CONFIG.INVERSE_RATE_PRECISION)} ${inputToken}`;
  
  return {
    outputAmountFormatted,
    rate,
    inverse
  };
}


// ------------------------------------------------------------------------------------------------------------ //
// ------------------------------------------------------------------------------------------------------------ //


export const pendleOpportunitiesTool = tool({
  description:
    'Get Pendle yield opportunities on Ethereum. This tool automatically renders UI.',
  parameters: z.object({
    max_results: z
      .number()
      .min(PENDLE_CONFIG.MIN_OPPORTUNITIES)
      .max(PENDLE_CONFIG.MAX_OPPORTUNITIES)
      .default(PENDLE_CONFIG.DEFAULT_OPPORTUNITIES)
      .describe(`Number of opportunities to return (default ${PENDLE_CONFIG.DEFAULT_OPPORTUNITIES})`),
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
    user_wallet_address: z.string().describe('The address of the user\'s EVM wallet.'),
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
      user_wallet_address,
      market_name,
      amount_in_human,
      token_type,
      direction
    } = params;
    const networkContext = context?.networkContext;
    
    try {
            
      // Prepare swap configuration using helper function
      const swapConfig = await prepareSwapConfiguration(
        token_address,
        token_type,
        direction,
        amount_in_human,
        market_name,
        PENDLE_CONFIG.DEFAULT_CHAIN_ID
      );
      
      // Call the getSwapQuote function
      const swapData = await getSwapQuote(
        swapConfig.marketAddress,
        swapConfig.tokenIn,
        swapConfig.tokenOut,
        swapConfig.amountInWei,
        PENDLE_CONFIG.DEFAULT_SLIPPAGE,
        PENDLE_CONFIG.ENABLE_AGGREGATOR,
        PENDLE_CONFIG.DEFAULT_CHAIN_ID,
        user_wallet_address
      );

      // Format output and calculate rates using helper function
      const outputData = await formatSwapOutput(
        swapData,
        direction,
        token_address,
        amount_in_human,
        swapConfig.inputToken,
        swapConfig.outputToken,
        PENDLE_CONFIG.DEFAULT_CHAIN_ID
      );
      
      const quoteData = {
        market: swapConfig.fullTokenName,
        inputAmount: amount_in_human,
        inputToken: swapConfig.inputToken,
        outputToken: swapConfig.outputToken,
        rate: outputData.rate,
        inverse: outputData.inverse,
        outputAmount: outputData.outputAmountFormatted,
        priceImpact: swapData.priceImpact,
        complete_time: new Date().toISOString(),
        foundMarketAddress: swapConfig.marketAddress,
        foundTokenAddress: token_address
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Quote for ${outputData.rate}`,
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
    user_wallet_address: z.string().describe('The address of the user\'s EVM wallet.'),
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
    input_token_name_display: z
      .string()
      .describe('The name of the input token. Used for display purposes.'),
    output_token_name_display: z
      .string()
      .describe('The name of the output token. Used for display purposes.'),
    amount_in_human: z
      .string()
      .describe(
        'Amount of input token to swap in human-readable format (e.g., "1", "100.5").'
      ),
    slippage: z
      .number()
      .min(PENDLE_CONFIG.MIN_SLIPPAGE)
      .max(PENDLE_CONFIG.MAX_SLIPPAGE)
      .default(PENDLE_CONFIG.DEFAULT_SLIPPAGE)
      .describe(`Maximum acceptable slippage (default: ${PENDLE_CONFIG.DEFAULT_SLIPPAGE}, which is ${PENDLE_CONFIG.DEFAULT_SLIPPAGE * 100}%).`),
    market_name: z
      .string()
      .optional()
      .describe('The name of the market (e.g. "rswETH"). Used for display purposes.')
  }),
  execute: async (params, context: ToolContext) => {
    let {
      token_address,
      user_wallet_address,
      direction,
      token_type,
      amount_in_human,
      slippage = PENDLE_CONFIG.DEFAULT_SLIPPAGE,
      market_name
    } = params;
    const networkContext = context?.networkContext;
    const isDemo = networkContext?.isDemo
    if (isDemo) {
      slippage = PENDLE_CONFIG.DEMO_SLIPPAGE
    }

    let displayTokenIn, displayTokenOut;
    try {

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
      
      // Prepare swap configuration using helper function
      const swapConfig = await prepareSwapConfiguration(
        token_address,
        token_type,
        direction,
        amount_in_human,
        market_name,
        chainId
      );
      
      // Set display tokens for UI
      displayTokenIn = swapConfig.inputToken;
      displayTokenOut = swapConfig.outputToken;

      // Execute the swap using executePendleSwap
      const result = await executePendleSwap(
        swapConfig.marketAddress,
        swapConfig.tokenIn,
        swapConfig.tokenOut,
        swapConfig.amountInWei,
        slippage,
        PENDLE_CONFIG.ENABLE_AGGREGATOR,
        chainId,
        isDemo,
        user_wallet_address
      );

      const explorerLink = getConfigByChainId(chainId!, isDemo).scanLink
      const explorerLinkWithHash = explorerLink?.startsWith('http') 
        ? `${explorerLink}/tx/${result.hash}`
        : `https://${explorerLink}/tx/${result.hash}`

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
      .default(0.1)
      .describe('Maximum acceptable slippage (default: 0.01, which is 1%).')
  }),
  execute: async (params, context: ToolContext) => {
    // Keep just one initial log for tracking execution
    console.log('Starting PT redemption for:', params.pt_address);
    
    const {
      pt_address,
      amount_in_human,
      token_name_display,
      slippage = PENDLE_CONFIG.DEFAULT_SLIPPAGE
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

      const chainId = networkContext?.selectedChainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID
      
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
          // Fallback to default decimals if token details can't be fetched
          // For expired tokens, default to standard ERC20 decimals
          const amountBigInt = ethers.parseUnits(amount_in_human, PENDLE_CONFIG.DEFAULT_DECIMALS)
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
        true,
        isDemo,
        pt_address.trim() // Pass the PT token address that was provided to the tool
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
      console.error('Redemption failed:', error.message);
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
      console.log('===== PENDLE REDEEM YT TOOL =====');
      console.log('Parameters:', JSON.stringify(params, null, 2));
      console.log('Network context:', JSON.stringify({
        chainId: networkContext?.selectedChainId,
        isDemo
      }, null, 2));
      
      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        console.error('Error: No wallet address found');
        throw new Error(
          'EVM wallet address not found. Please connect your wallet.'
        )
      }
      console.log('Wallet address:', evmWalletAddress);

      const chainId = networkContext?.selectedChainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID

      // Check if YT addresses array has items
      if (!yt_addresses || yt_addresses.length === 0) {
        console.error('Error: Empty YT addresses array');
        throw new Error('YT addresses array must contain at least one address')
      }
      console.log(`Processing ${yt_addresses.length} YT addresses`);

      // Process addresses to ensure they're properly formatted
      const processedYtAddresses = yt_addresses.map(addr => addr.trim());
      console.log('Processed YT addresses:', processedYtAddresses);
      
      // Define empty arrays for market_addresses and sy_addresses as placeholders for future
      const processedMarketAddresses: string[] = []
      const processedSyAddresses: string[] = []
      console.log('Using empty market and SY addresses');

      // Execute the redemption transaction
      console.log('Executing redemption transaction for YT rewards...');
      const result = await executeRedeemInterestsAndRewardsTransaction(
        processedSyAddresses.length > 0 ? processedSyAddresses : undefined,
        processedYtAddresses,
        processedMarketAddresses.length > 0 ? processedMarketAddresses : undefined,
        chainId,
        isDemo
      )
      console.log('Redemption result:', JSON.stringify(result, null, 2));
      
      if (result.status !== 'success') {
        console.error('Redemption failed:', result.message);
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
      console.log('Redemption successful:', JSON.stringify(redeemData, null, 2));
      
      return {
        _uiDisplayTool: true,
        summary: `YT rewards redemption executed successfully`,
        data: redeemData
      }
    } catch (error: any) {
      console.error('Error in pendleRedeemYTTool:', error);
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

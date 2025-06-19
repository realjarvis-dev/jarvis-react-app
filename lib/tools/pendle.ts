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
 * Helper function to find a Pendle market by token address using static cache
 * @param tokenAddress The PT or YT token address to search for
 * @param tokenType The type of token - 'pt' or 'yt'
 * @param chainId The chain ID to search on
 * @returns The found market object
 * @throws Error if no market is found with the given token address
 */
async function findMarketByTokenAddress(tokenAddress: string, tokenType: 'pt' | 'yt' | 'sy', chainId: number = 1) {
  if (!tokenAddress) {
    throw new Error('Token address must be provided');
  }
  
  const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher');
  
  const market = pendleTokenMatcher.findMarketByTokenAddress(tokenAddress, tokenType, chainId);
  
  if (!market) {
    throw new Error(`Could not find a Pendle market with ${tokenType.toUpperCase()} token address ${tokenAddress} on chain ${chainId}`);
  }
  
  return {
    name: market.name,
    address: market.address,
    expiry: market.expiry,
    pt: market.pt,
    yt: market.yt,
    sy: market.sy,
    underlyingAsset: market.underlyingAsset,
    liquidity: 0,
    impliedApy: 0,
    active: true
  };
}

/**
 * Helper function to parse token amount from human-readable format to wei
 * @param tokenAddress The token contract address
 * @param amountHuman The human-readable amount to convert
 * @param chainId The chain ID for token details lookup
 * @returns Amount in wei as string
 */
async function parseTokenAmount(
  tokenAddress: string,
  amountHuman: string,
  chainId: number = PENDLE_CONFIG.DEFAULT_CHAIN_ID
): Promise<string> {
  try {
    const tokenDetails = await getERC20Details(tokenAddress, chainId);
    return ethers.parseUnits(amountHuman, tokenDetails.decimals).toString();
  } catch (error) {
    // Fallback to default decimals if token details can't be fetched
    return ethers.parseUnits(amountHuman, PENDLE_CONFIG.DEFAULT_DECIMALS).toString();
  }
}

/**
 * Helper function to prepare swap token configuration for Pendle operations
 * @param tokenAddress The PT or YT token address
 * @param tokenType The type of token - 'pt' or 'yt'
 * @param direction The swap direction - 'ethToToken' or 'tokenToEth'
 * @param marketName The market name for display purposes
 * @returns Prepared swap token configuration object
 */
async function prepareSwapTokens(
  tokenAddress: string,
  tokenType: 'pt' | 'yt',
  direction: 'ethToToken' | 'tokenToEth',
  marketName?: string,
  chainId?: number
) {
  // Find market that contains the token
  const foundMarket = await findMarketByTokenAddress(tokenAddress, tokenType, chainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID);
  
  const marketAddress = foundMarket.address;
  const tokenSymbol = marketName || foundMarket.name;
  const fullTokenName = `${tokenType.toUpperCase()} ${tokenSymbol}`;

  // Determine tokenIn, tokenOut
  let tokenIn: string;
  let tokenOut: string;
  let inputToken: string;
  let outputToken: string;
  
  if (direction === 'ethToToken') {
    tokenIn = PENDLE_CONFIG.ETH_ADDRESS_PENDLE;
    tokenOut = tokenAddress;
    inputToken = PENDLE_CONFIG.ETH_SYMBOL;
    outputToken = fullTokenName;
  } else {
    tokenIn = tokenAddress;
    tokenOut = PENDLE_CONFIG.ETH_ADDRESS_PENDLE;
    inputToken = fullTokenName;
    outputToken = PENDLE_CONFIG.ETH_SYMBOL;
  }

  return {
    foundMarket,
    marketAddress,
    fullTokenName,
    tokenIn,
    tokenOut,
    inputToken,
    outputToken
  };
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
  // Get token configuration
  const swapTokens = await prepareSwapTokens(tokenAddress, tokenType, direction, marketName, chainId);
  
  // Parse amount to wei based on direction
  let amountInWei: string;
  if (direction === 'ethToToken') {
    // For ETH input, use parseEther
    amountInWei = ethers.parseEther(amountHuman).toString();
  } else {
    // For token input, use parseTokenAmount
    amountInWei = await parseTokenAmount(tokenAddress, amountHuman, chainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID);
  }

  return {
    ...swapTokens,
    amountInWei
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
    'Get a quote for swapping between ETH and a Pendle market token. Accepts either token address or token name (e.g. "sENA PT", "PT-sENA-25SEP2025"). This tool automatically renders UI.',
  parameters: z.object({
    token_address: z.string().describe('The address of the PT or YT token, OR the token name/symbol (e.g. "sENA PT", "PT-sENA-25SEP2025"). The market will be automatically determined from this token.'),
    user_wallet_address: z.string().describe('The address of the user\'s EVM wallet.'),
    market_name: z
      .string()
      .optional()
      .describe('The name of the market (optional, will be auto-determined if not provided)'),
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
      token_address: tokenAddressOrName,
      user_wallet_address,
      market_name,
      amount_in_human,
      token_type,
      direction
    } = params;
    const networkContext = context?.networkContext;
    const chainId = networkContext?.selectedChainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID;
    
    try {
      let resolvedTokenAddress = tokenAddressOrName;
      let resolvedMarketName = market_name;
      
      const isAddress = /^0x[a-fA-F0-9]{40}$/.test(tokenAddressOrName);
      
      if (!isAddress) {
        const { TokenMatcher } = await import('../token-matcher/fuzzy-token-matcher');
        const tokenMatcher = new TokenMatcher(chainId);
        const matches = tokenMatcher.match(tokenAddressOrName, 5);
        
        const pendleMatches = matches.filter(token => {
          const symbol = token.symbol.toLowerCase();
          const name = token.name.toLowerCase();
          const query = tokenAddressOrName.toLowerCase().replace(/\s+/g, '');
          
          const isCorrectType = token_type === 'pt' ? symbol.includes('pt-') : symbol.includes('yt-');
          
          const matchesQuery = symbol.includes(query) || 
                              name.includes(query) ||
                              (query.includes('solvbtc') && (symbol.includes('xsolvbtc') || name.includes('xsolvbtc'))) ||
                              (query.includes('sena') && (symbol.includes('sena') || name.includes('sena'))) ||
                              (query.includes('eusde') && (symbol.includes('eusde') || name.includes('eusde'))) ||
                              symbol.replace(/[^a-z0-9]/g, '').includes(query.replace(/[^a-z0-9]/g, '')) ||
                              name.replace(/[^a-z0-9]/g, '').includes(query.replace(/[^a-z0-9]/g, ''));
          
          return isCorrectType && matchesQuery;
        });
        
        if (pendleMatches.length > 0) {
          resolvedTokenAddress = pendleMatches[0].address;
          resolvedMarketName = resolvedMarketName || pendleMatches[0].name.replace(/^(PT|YT)\s+/, '');
        } else {
          const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher');
          const allPendleTokens = pendleTokenMatcher.getAllTokensForChain(chainId);
          
          const similarTokens = allPendleTokens
            .filter(token => {
              const symbol = token.symbol.toLowerCase();
              const isCorrectType = token_type === 'pt' ? symbol.includes('pt-') : symbol.includes('yt-');
              
              const query = tokenAddressOrName.toLowerCase().replace(/\s+/g, '');
              const tokenName = token.name.toLowerCase();
              const tokenSymbol = symbol;
              
              return isCorrectType && (
                tokenName.includes(query.substring(0, 4)) || // Match first 4 chars
                tokenSymbol.includes(query.substring(0, 4)) ||
                query.includes(tokenName.substring(3, 7)) || // Skip PT-/YT- prefix
                query.includes(tokenSymbol.substring(3, 7))
              );
            })
            .slice(0, 3)
            .map(token => token.name.replace(/^(PT|YT)\s+/, ''))
            .join(', ');
          
          const suggestion = similarTokens 
            ? `Could not find a Pendle ${token_type.toUpperCase()} token matching "${tokenAddressOrName}" on chain ${chainId}. Did you mean one of these: ${similarTokens}? Please provide a valid token address or try a different token name.`
            : `Could not find a Pendle ${token_type.toUpperCase()} token matching "${tokenAddressOrName}" on chain ${chainId}. Please provide a valid token address or try a different token name.`;
          
          throw new Error(suggestion);
        }
      }
            
      const swapConfig = await prepareSwapConfiguration(
        resolvedTokenAddress,
        token_type,
        direction,
        amount_in_human,
        resolvedMarketName,
        chainId
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

      const outputData = await formatSwapOutput(
        swapData,
        direction,
        resolvedTokenAddress,
        amount_in_human,
        swapConfig.inputToken,
        swapConfig.outputToken,
        chainId
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
        foundTokenAddress: resolvedTokenAddress
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
        token_address: tokenAddressOrName
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
      .describe(
        'The token type - "pt" for Principal Token or "yt" for Yield Token.'
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
        user_wallet_address,
        token_type
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

export const pendleRedeemQuoteTool = tool({
  description:
    `Get a quote for redeeming Pendle tokens using different input/output combinations. 
    Supports py->sy, py->underlying, and sy->underlying redemption quotes.
    Provide the PT token address to automatically determine the market and token addresses.
    This tool automatically renders UI.`,
  parameters: z.object({
    pt_address: z
      .string()
      .describe('The address of the PT (Principal Token). The market, YT, and SY addresses will be automatically determined from this token.'),
    token_input_type: z
      .enum(['py', 'sy'])
      .describe('The type of input tokens - "py" for PT+YT tokens or "sy" for SY token only.'),
    token_output_type: z
      .enum(['sy', 'underlying'])
      .describe('The type of output token - "sy" for SY token or "underlying" for the underlying asset token.'),
    amount_in_human: z
      .string()
      .describe('Amount of input tokens to redeem in human-readable format (e.g., "1", "100.5"). For py input, equal amounts of PT and YT will be burned.'),
    user_wallet_address: z
      .string()
      .describe('The address of the user\'s EVM wallet'),
    slippage: z
      .number()
      .min(PENDLE_CONFIG.MIN_SLIPPAGE)
      .max(PENDLE_CONFIG.MAX_SLIPPAGE)
      .default(PENDLE_CONFIG.DEFAULT_SLIPPAGE)
      .describe(`Maximum acceptable slippage (default: ${PENDLE_CONFIG.DEFAULT_SLIPPAGE}, which is ${PENDLE_CONFIG.DEFAULT_SLIPPAGE * 100}%)`)
  }),
  execute: async (params, context: ToolContext) => {
    const {
      pt_address,
      token_input_type,
      token_output_type,
      amount_in_human,
      user_wallet_address,
      slippage = PENDLE_CONFIG.DEFAULT_SLIPPAGE
    } = params;
    const networkContext = context?.networkContext;
    const chainId = networkContext?.selectedChainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt');
      const ytAddress = foundMarket.yt;
      const syAddress = foundMarket.sy;
      const marketName = foundMarket.name;

      // Determine the actual token_out based on token_output_type
      let actualTokenOut: string;
      if (token_output_type === 'sy') {
        actualTokenOut = syAddress;
      } else {
        actualTokenOut = foundMarket.underlyingAsset;
      }

      let quote: any;
      let inputTokenAddress: string;
      let inputTokenDisplay: string;
      let outputTokenDisplay: string;

      if (token_input_type === 'py') {
        // PY redemption quote: quote PT+YT tokens
        inputTokenAddress = pt_address;
        inputTokenDisplay = `PT+YT ${marketName}`;
        outputTokenDisplay = token_output_type === 'sy' ? `SY ${marketName}` : marketName;

        // Convert amount to wei using PT address for decimals
        const amountInWei = await parseTokenAmount(pt_address, amount_in_human, chainId);

        // Get PY redemption quote using YT address (as required by the quote function)
        quote = await getRedeemPyQuote(
          ytAddress,
          amountInWei,
          actualTokenOut,
          slippage,
          chainId,
          user_wallet_address
        );
      } else {
        // SY redemption quote: quote SY tokens
        inputTokenAddress = syAddress;
        inputTokenDisplay = `SY ${marketName}`;
        outputTokenDisplay = marketName; // SY can only redeem to underlying

        // Convert amount to wei using SY address for decimals
        const amountInWei = await parseTokenAmount(syAddress, amount_in_human, chainId);

        // Get SY redemption quote
        quote = await getRedeemSyQuote(
          syAddress,
          amountInWei,
          actualTokenOut,
          slippage,
          chainId,
          user_wallet_address
        );
      }

      // Format the output amount
      let outputAmountFormatted: string;
      try {
        const tokenDetails = await getERC20Details(actualTokenOut, chainId);
        outputAmountFormatted = ethers.formatUnits(quote.amountOut, tokenDetails.decimals);
      } catch (error) {
        // Fallback to default decimals
        outputAmountFormatted = ethers.formatUnits(quote.amountOut, PENDLE_CONFIG.DEFAULT_DECIMALS);
      }

      // Create rate string
      const rate = `${amount_in_human} ${inputTokenDisplay} → ${outputAmountFormatted} ${outputTokenDisplay}`;

      // Calculate inverse rate
      const inputAmount = parseFloat(amount_in_human);
      const outputAmount = parseFloat(outputAmountFormatted);
      const inverseRatio = inputAmount / outputAmount;
      const inverse = `1 ${outputTokenDisplay} → ${inverseRatio.toFixed(PENDLE_CONFIG.INVERSE_RATE_PRECISION)} ${inputTokenDisplay}`;

      const quoteData = {
        market: marketName,
        inputAmount: amount_in_human,
        inputToken: inputTokenDisplay,
        outputToken: outputTokenDisplay,
        rate: rate,
        inverse: inverse,
        outputAmount: outputAmountFormatted,
        priceImpact: quote.priceImpact,
        complete_time: new Date().toISOString(),
        chainId: chainId,
        pt_address: pt_address,
        yt_address: ytAddress,
        sy_address: syAddress
      };

      return {
        _uiDisplayTool: true,
        summary: `Redeem quote: ${rate}`,
        data: quoteData
      };
    } catch (error: any) {
      const errorData = {
        error: error.message || 'Failed to get Pendle redeem quote.',
        redeem_parameters: {
          pt_address,
          token_input_type,
          token_output_type,
          amount_in_human,
          slippage
        }
      };
      
      return {
        _uiDisplayTool: true,
        summary: `Error getting redeem quote: ${error.message || 'Failed to get Pendle redeem quote'}`,
        data: errorData
      };
    }
  }
});

export const pendleMintQuoteTool = tool({
  description:
    `Get a quote for minting Pendle tokens using different input/output combinations. 
    Supports underlying->py, sy->py, and underlying->sy minting quotes.
    Provide the PT token address to automatically determine the market and token addresses.
    This tool automatically renders UI.`,
  parameters: z.object({
    pt_address: z
      .string()
      .describe('The address of the PT (Principal Token). The market, YT, and SY addresses will be automatically determined from this token.'),
    token_input_type: z
      .enum(['underlying', 'sy'])
      .describe('The type of input tokens - "underlying" for underlying asset tokens or "sy" for SY token.'),
    token_output_type: z
      .enum(['py', 'sy'])
      .describe('The type of output tokens - "py" for PT+YT tokens or "sy" for SY token only.'),
    amount_in_human: z
      .string()
      .describe('Amount of input tokens to mint from in human-readable format (e.g., "1", "100.5").'),
    user_wallet_address: z
      .string()
      .describe('The address of the user\'s EVM wallet'),
    slippage: z
      .number()
      .min(PENDLE_CONFIG.MIN_SLIPPAGE)
      .max(PENDLE_CONFIG.MAX_SLIPPAGE)
      .default(PENDLE_CONFIG.DEFAULT_SLIPPAGE)
      .describe(`Maximum acceptable slippage (default: ${PENDLE_CONFIG.DEFAULT_SLIPPAGE}, which is ${PENDLE_CONFIG.DEFAULT_SLIPPAGE * 100}%)`)
  }),
  execute: async (params, context: ToolContext) => {
    const {
      pt_address,
      token_input_type,
      token_output_type,
      amount_in_human,
      user_wallet_address,
      slippage = PENDLE_CONFIG.DEFAULT_SLIPPAGE
    } = params;
    const networkContext = context?.networkContext;
    const chainId = networkContext?.selectedChainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt');
      const ytAddress = foundMarket.yt;
      const syAddress = foundMarket.sy;
      const marketName = foundMarket.name;

      // Determine the actual token_in based on token_input_type
      let actualTokenIn: string;
      if (token_input_type === 'sy') {
        actualTokenIn = syAddress;
      } else {
        actualTokenIn = foundMarket.underlyingAsset;
      }

      let quote: any;
      let inputTokenDisplay: string;
      let outputTokenDisplay: string;

      if (token_output_type === 'py') {
        // PY minting quote: quote PT+YT tokens
        inputTokenDisplay = token_input_type === 'sy' ? `SY ${marketName}` : marketName;
        outputTokenDisplay = `PT+YT ${marketName}`;

        // Convert amount to wei using input token address for decimals
        const amountInWei = await parseTokenAmount(actualTokenIn, amount_in_human, chainId);

        // Get PY minting quote using YT address (as required by the quote function)
        quote = await getMintPyQuote(
          ytAddress,
          actualTokenIn,
          amountInWei,
          slippage,
          chainId,
          user_wallet_address
        );
      } else {
        // SY minting quote: quote SY tokens (only from underlying)
        if (token_input_type !== 'underlying') {
          throw new Error('SY tokens can only be minted from underlying tokens, not from other SY tokens');
        }
        
        inputTokenDisplay = marketName;
        outputTokenDisplay = `SY ${marketName}`;

        // Convert amount to wei using underlying token address for decimals
        const amountInWei = await parseTokenAmount(actualTokenIn, amount_in_human, chainId);

        // Get SY minting quote
        quote = await getMintSyQuote(
          syAddress,
          actualTokenIn,
          amountInWei,
          slippage,
          chainId,
          user_wallet_address
        );
      }

      // Format the output amount
      let outputAmountFormatted: string;
      try {
        if (token_output_type === 'py') {
          const tokenDetails = await getERC20Details(pt_address, chainId);
          outputAmountFormatted = ethers.formatUnits(quote.amountOut, tokenDetails.decimals);
        } else {
          const syTokenDetails = await getERC20Details(syAddress, chainId);
          outputAmountFormatted = ethers.formatUnits(quote.amountOut, syTokenDetails.decimals);
        }
      } catch (error) {
        // Fallback to default decimals
        outputAmountFormatted = ethers.formatUnits(quote.amountOut, PENDLE_CONFIG.DEFAULT_DECIMALS);
      }

      // Create rate string
      const rate = `${amount_in_human} ${inputTokenDisplay} → ${outputAmountFormatted} ${outputTokenDisplay}`;

      // Calculate inverse rate
      const inputAmount = parseFloat(amount_in_human);
      const outputAmount = parseFloat(outputAmountFormatted);
      const inverseRatio = inputAmount / outputAmount;
      const inverse = `1 ${outputTokenDisplay} → ${inverseRatio.toFixed(PENDLE_CONFIG.INVERSE_RATE_PRECISION)} ${inputTokenDisplay}`;

      const quoteData = {
        market: marketName,
        inputAmount: amount_in_human,
        inputToken: inputTokenDisplay,
        outputToken: outputTokenDisplay,
        rate: rate,
        inverse: inverse,
        outputAmount: outputAmountFormatted,
        priceImpact: quote.priceImpact,
        complete_time: new Date().toISOString(),
        chainId: chainId,
        pt_address: pt_address,
        yt_address: ytAddress,
        sy_address: syAddress,
        actual_token_in: actualTokenIn
      };

      return {
        _uiDisplayTool: true,
        summary: `Mint quote: ${rate}`,
        data: quoteData
      };
    } catch (error: any) {
      const errorData = {
        error: error.message || 'Failed to get Pendle mint quote.',
        mint_parameters: {
          pt_address,
          token_input_type,
          token_output_type,
          amount_in_human,
          slippage
        }
      };
      
      return {
        _uiDisplayTool: true,
        summary: `Error getting mint quote: ${error.message || 'Failed to get Pendle mint quote'}`,
        data: errorData
      };
    }
  }
});

export const pendleRedeemTool = tool({
  description:
    `Redeem Pendle tokens using different input/output combinations. 
    Supports py->sy, py->underlying, and sy->underlying redemptions.
    Provide the PT token address to automatically determine the market and token addresses.
    This tool automatically renders UI.`,
  parameters: z.object({
    pt_address: z
      .string()
      .describe('The address of the PT (Principal Token). The market, YT, and SY addresses will be automatically determined from this token.'),
    token_input_type: z
      .enum(['py', 'sy'])
      .describe('The type of input tokens - "py" for PT+YT tokens or "sy" for SY token only.'),
    token_output_type: z
      .enum(['sy', 'underlying'])
      .describe('The type of output token - "sy" for SY token or "underlying" for the underlying asset token.'),
    amount_in_human: z
      .string()
      .describe('Amount of input tokens to redeem in human-readable format (e.g., "1", "100.5"). For py input, equal amounts of PT and YT will be burned.'),
    user_wallet_address: z
      .string()
      .describe('The address of the user\'s EVM wallet'),
    slippage: z
      .number()
      .min(PENDLE_CONFIG.MIN_SLIPPAGE)
      .max(PENDLE_CONFIG.MAX_SLIPPAGE)
      .default(PENDLE_CONFIG.DEFAULT_SLIPPAGE)
      .describe(`Maximum acceptable slippage (default: ${PENDLE_CONFIG.DEFAULT_SLIPPAGE}, which is ${PENDLE_CONFIG.DEFAULT_SLIPPAGE * 100}%)`)
  }),
  execute: async (params, context: ToolContext) => {
    const {
      pt_address,
      token_input_type,
      token_output_type,
      amount_in_human,
      user_wallet_address,
      slippage = PENDLE_CONFIG.DEFAULT_SLIPPAGE
    } = params;
    const networkContext = context?.networkContext;
    const isDemo = networkContext?.isDemo;
    const chainId = networkContext?.selectedChainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt');
      const ytAddress = foundMarket.yt;
      const syAddress = foundMarket.sy;
      const marketName = foundMarket.name;

      // Determine the actual token_out based on token_output_type
      let actualTokenOut: string;
      if (token_output_type === 'sy') {
        actualTokenOut = syAddress;
      } else {
        actualTokenOut = foundMarket.underlyingAsset;
      }

      let result: any;
      let inputTokenAddress: string;
      let inputTokenDisplay: string;
      let outputTokenDisplay: string;

      if (token_input_type === 'py') {
        // PY redemption: redeem PT+YT tokens
        inputTokenAddress = pt_address;
        inputTokenDisplay = `PT+YT ${marketName}`;
        outputTokenDisplay = token_output_type === 'sy' ? `SY ${marketName}` : marketName;

        // Convert amount to wei using PT address for decimals
        const amountInWei = await parseTokenAmount(pt_address, amount_in_human, chainId);

        // Execute PY redemption using YT address (as required by the redeem function)
        result = await executePendleRedeemPy(
          ytAddress,
          amountInWei,
          actualTokenOut,
          slippage,
          chainId,
          isDemo || false,
          user_wallet_address
        );
      } else {
        // SY redemption: redeem SY tokens
        inputTokenAddress = syAddress;
        inputTokenDisplay = `SY ${marketName}`;
        outputTokenDisplay = marketName; // SY can only redeem to underlying

        // Convert amount to wei using SY address for decimals
        const amountInWei = await parseTokenAmount(syAddress, amount_in_human, chainId);

        // Execute SY redemption
        result = await executePendleRedeemSy(
          syAddress,
          amountInWei,
          actualTokenOut,
          slippage,
          chainId,
          isDemo || false,
          user_wallet_address
        );
      }

      const explorerLink = getConfigByChainId(chainId, isDemo || false).scanLink;
      const explorerLinkWithHash = explorerLink?.startsWith('http') 
        ? `${explorerLink}/tx/${result.hash}`
        : `https://${explorerLink}/tx/${result.hash}`;

      const redeemData = {
        success: true,
        transaction_hash: result.hash,
        redeem_details: {
          market: marketName,
          input_token_type: token_input_type.toUpperCase(),
          output_token_type: token_output_type === 'sy' ? 'SY' : 'Token',
          input_token: inputTokenAddress,
          output_token: actualTokenOut,
          amount_in: `${amount_in_human}`,
          pt_address: pt_address,
          yt_address: ytAddress,
          sy_address: syAddress,
          complete_time: new Date().toISOString(),
          chainId: chainId,
          explorer_link: explorerLink ? explorerLinkWithHash : undefined
        }
      };

      return {
        _uiDisplayTool: true,
        summary: `Redeem executed: ${amount_in_human} ${inputTokenDisplay} → ${outputTokenDisplay}`,
        data: redeemData
      };
    } catch (error: any) {
      const errorData = {
        success: false,
        error: error.message || 'Failed to execute Pendle redeem.',
        redeem_parameters: {
          pt_address,
          token_input_type,
          token_output_type,
          amount_in_human,
          slippage
        }
      };
      
      return {
        _uiDisplayTool: true,
        summary: `Redeem failed: ${error.message || 'Failed to execute Pendle redeem'}`,
        data: errorData
      };
    }
  }
});

export const pendleMintTool = tool({
  description:
    `Mint Pendle tokens using different input/output combinations. 
    Supports underlying->py, sy->py, and underlying->sy minting.
    Provide the PT token address to automatically determine the market and token addresses.
    This tool automatically renders UI.`,
  parameters: z.object({
    pt_address: z
      .string()
      .describe('The address of the PT (Principal Token). The market, YT, and SY addresses will be automatically determined from this token.'),
    token_input_type: z
      .enum(['underlying', 'sy'])
      .describe('The type of input tokens - "underlying" for underlying asset tokens or "sy" for SY token.'),
    token_output_type: z
      .enum(['py', 'sy'])
      .describe('The type of output tokens - "py" for PT+YT tokens or "sy" for SY token only.'),
    amount_in_human: z
      .string()
      .describe('Amount of input tokens to mint from in human-readable format (e.g., "1", "100.5").'),
    user_wallet_address: z
      .string()
      .describe('The address of the user\'s EVM wallet'),
    slippage: z
      .number()
      .min(PENDLE_CONFIG.MIN_SLIPPAGE)
      .max(PENDLE_CONFIG.MAX_SLIPPAGE)
      .default(PENDLE_CONFIG.DEFAULT_SLIPPAGE)
      .describe(`Maximum acceptable slippage (default: ${PENDLE_CONFIG.DEFAULT_SLIPPAGE}, which is ${PENDLE_CONFIG.DEFAULT_SLIPPAGE * 100}%)`)
  }),
  execute: async (params, context: ToolContext) => {
    const {
      pt_address,
      token_input_type,
      token_output_type,
      amount_in_human,
      user_wallet_address,
      slippage = PENDLE_CONFIG.DEFAULT_SLIPPAGE
    } = params;
    const networkContext = context?.networkContext;
    const isDemo = networkContext?.isDemo;
    const chainId = networkContext?.selectedChainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt');
      const ytAddress = foundMarket.yt;
      const syAddress = foundMarket.sy;
      const marketName = foundMarket.name;

      // Determine the actual token_in based on token_input_type
      let actualTokenIn: string;
      if (token_input_type === 'sy') {
        actualTokenIn = syAddress;
      } else {
        actualTokenIn = foundMarket.underlyingAsset;
      }

      let result: any;
      let inputTokenDisplay: string;
      let outputTokenDisplay: string;

      if (token_output_type === 'py') {
        // PY minting: mint PT+YT tokens
        inputTokenDisplay = token_input_type === 'sy' ? `SY ${marketName}` : marketName;
        outputTokenDisplay = `PT+YT ${marketName}`;

        // Convert amount to wei using input token address for decimals
        const amountInWei = await parseTokenAmount(actualTokenIn, amount_in_human, chainId);

        // Execute PY minting using YT address (as required by the mint function)
        result = await executePendleMintPy(
          ytAddress,
          actualTokenIn,
          amountInWei,
          slippage,
          chainId,
          isDemo || false,
          user_wallet_address
        );
      } else {
        // SY minting: mint SY tokens (only from underlying)
        if (token_input_type !== 'underlying') {
          throw new Error('SY tokens can only be minted from underlying tokens, not from other SY tokens');
        }
        
        inputTokenDisplay = marketName;
        outputTokenDisplay = `SY ${marketName}`;

        // Convert amount to wei using underlying token address for decimals
        const amountInWei = await parseTokenAmount(actualTokenIn, amount_in_human, chainId);

        // Execute SY minting
        result = await executePendleMintSy(
          syAddress,
          actualTokenIn,
          amountInWei,
          slippage,
          chainId,
          isDemo || false,
          user_wallet_address
        );
      }

      const explorerLink = getConfigByChainId(chainId, isDemo || false).scanLink;
      const explorerLinkWithHash = explorerLink?.startsWith('http') 
        ? `${explorerLink}/tx/${result.hash}`
        : `https://${explorerLink}/tx/${result.hash}`;

      const mintData = {
        success: true,
        transaction_hash: result.hash,
        mint_details: {
          market: marketName,
          input_token_type: token_input_type.toUpperCase(),
          output_token_type: token_output_type.toUpperCase(),
          input_token: actualTokenIn,
          output_token: token_output_type === 'py' ? `${pt_address},${ytAddress}` : syAddress,
          amount_in: `${amount_in_human}`,
          pt_address: pt_address,
          yt_address: ytAddress,
          sy_address: syAddress,
          complete_time: new Date().toISOString(),
          chainId: chainId,
          explorer_link: explorerLink ? explorerLinkWithHash : undefined
        }
      };

      return {
        _uiDisplayTool: true,
        summary: `Mint executed: ${amount_in_human} ${inputTokenDisplay} → ${outputTokenDisplay}`,
        data: mintData
      };
    } catch (error: any) {
      const errorData = {
        success: false,
        error: error.message || 'Failed to execute Pendle mint.',
        mint_parameters: {
          pt_address,
          token_input_type,
          token_output_type,
          amount_in_human,
          slippage
        }
      };
      
      return {
        _uiDisplayTool: true,
        summary: `Mint failed: ${error.message || 'Failed to execute Pendle mint'}`,
        data: errorData
      };
    }
  }
});

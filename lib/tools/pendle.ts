import { tool } from 'ai'
import { ethers } from 'ethers'
import { z } from 'zod'
import { getConfigByChainId } from '../network/config'
import { getPendleMarkets } from '../pendle/api'
import { executePendleMintPy, getMintPyQuote } from '../pendle/mint-py'
import { executePendleMintSy, getMintSyQuote } from '../pendle/mint-sy'
import { executePendleRedeemPy, getRedeemPyQuote } from '../pendle/redeem-py'
import { executePendleRedeemSy, getRedeemSyQuote } from '../pendle/redeem-sy'
import { executePendleSwap, getPendleSwapTransactionData, getSwapQuote } from '../pendle/swap'
import { getERC20Details } from '../privy/utils'
import { NetworkContext } from '../types/context'
import { createTransactionPreview } from '../utils/gas-estimation'
import { getEffectiveAmount, getUsdSupportDescription, parseUsdAmount } from '../utils/usd-parser'

/**
 * Categorize price impact level for user warnings
 * @param priceImpact Price impact percentage (e.g., 5.5 for 5.5%)
 * @returns Price impact level category
 */
function getPriceImpactLevel(priceImpact: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (priceImpact <= 1) return 'low';
  if (priceImpact <= 5) return 'medium';
  if (priceImpact <= 15) return 'high';
  return 'extreme';
}

/**
 * Get token decimals for formatting
 */
async function getTokenDecimals(tokenAddress: string, chainId: number): Promise<number> {
  try {
    const tokenDetails = await getERC20Details(tokenAddress, chainId);
    return tokenDetails.decimals;
  } catch (error) {
    return 18; // Default decimals
  }
}

async function resolveTokenAddress(
  tokenAddressOrName: string, 
  token_type: string, 
  chainId: number
): Promise<{ resolvedTokenAddress: string; resolvedMarketName?: string }> {
  let resolvedTokenAddress = tokenAddressOrName;
  let resolvedMarketName: string | undefined;
  
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(tokenAddressOrName);
  
  if (!isAddress) {
    const { TokenMatcher } = await import('../token-matcher/fuzzy-token-matcher');
    const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher');
    
    // Get all Pendle tokens for the chain first to filter by expiry and network
    const allPendleTokens = pendleTokenMatcher.getAllTokensForChain(chainId);
    const now = new Date();
    
    // Filter tokens by chain, type, and expiry status
    const activeTokens = allPendleTokens.filter(token => {
      const symbol = token.symbol.toLowerCase();
      const isCorrectType = token_type === 'pt' ? symbol.includes('pt-') : symbol.includes('yt-');
      const isActiveToken = new Date(token.expiry) > now; // Not expired
      const isCorrectChain = token.chainId === chainId; // Match network context
      
      return isCorrectType && isActiveToken && isCorrectChain;
    });
    
    if (activeTokens.length === 0) {
      throw new Error(`No active Pendle ${token_type.toUpperCase()} tokens found on chain ${chainId}`);
    }
    
    // Use TokenMatcher with filtered active tokens only
    const tokenMatcher = new TokenMatcher(chainId, 0.3, activeTokens.map(token => ({
      chainId: token.chainId,
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals
    })));
    
    const matches = tokenMatcher.match(tokenAddressOrName, 10); // Get more matches to sort by expiry
    
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
                          name.replace(/[^a-z0-9]/g, '').includes(query.replace(/[^a-z0-9]/g, '')) ||
                          (() => {
                            if (query.endsWith('pt') || query.endsWith('yt')) {
                              const baseQuery = query.slice(0, -2);
                              return baseQuery && (symbol.includes(baseQuery) || name.includes(baseQuery));
                            }
                            
                            const baseQuery = query.replace(/^(pt|yt)/, '').replace(/(pt|yt)$/, '');
                            if (baseQuery && baseQuery !== query) {
                              const baseSymbol = symbol.replace(/^pt-/, '').replace(/^yt-/, '').split('-')[0];
                              const baseName = name.replace(/^(pt|yt)\s+/, '').split(' ')[0].toLowerCase();
                              return baseSymbol.includes(baseQuery) || baseName.includes(baseQuery);
                            }
                            
                            return false;
                          })();
      
      return isCorrectType && matchesQuery;
    });
    
    if (pendleMatches.length > 0) {
      // Fetch market data to get APY information for better token selection
      let marketsWithApy: any[] = [];
      try {
        const { getPendleMarkets } = await import('../pendle/api');
        marketsWithApy = await getPendleMarkets('active', chainId);
      } catch (error) {
        console.warn('Could not fetch market APY data for token selection:', error);
        marketsWithApy = [];
      }

      // Create a mapping from PT/YT address to market APY for prioritization
      const tokenApyMap = new Map<string, number>();
      for (const market of marketsWithApy) {
        if (market.pt) tokenApyMap.set(market.pt.toLowerCase(), market.impliedApy);
        if (market.yt) tokenApyMap.set(market.yt.toLowerCase(), market.impliedApy);
      }

      // Sort by match score first, then by APY (higher is better), then by expiry
      const sortedMatches = pendleMatches.map(token => {
        const pendleToken = activeTokens.find(pt => pt.address === token.address);
        const tokenApy = tokenApyMap.get(token.address.toLowerCase()) || 0;
        return {
          ...token,
          expiry: pendleToken?.expiry,
          expiryDate: pendleToken ? new Date(pendleToken.expiry) : now,
          apy: tokenApy
        };
      }).sort((a, b) => {
        // First sort by match score (lower is better)
        if (Math.abs(a.score - b.score) > 0.01) {
          return a.score - b.score;
        }
        // Then by APY (higher is better for better returns)
        if (Math.abs(a.apy - b.apy) > 0.001) {
          return b.apy - a.apy;
        }
        // Finally by expiry date (later expiry is better as fallback)
        return b.expiryDate.getTime() - a.expiryDate.getTime();
      });
      
      resolvedTokenAddress = sortedMatches[0].address;
      resolvedMarketName = sortedMatches[0].name.replace(/^(PT|YT)\s+/, '');
    } else {
      // Fallback: suggest similar active tokens
      const similarTokens = activeTokens
        .filter(token => {
          const symbol = token.symbol.toLowerCase();
          const isCorrectType = token_type === 'pt' ? symbol.includes('pt-') : symbol.includes('yt-');
          
          const query = tokenAddressOrName.toLowerCase().replace(/\s+/g, '');
          const tokenName = token.name.toLowerCase();
          const tokenSymbol = symbol;
          
          return isCorrectType && (
            tokenName.includes(query.substring(0, 4)) ||
            tokenSymbol.includes(query.substring(0, 4)) ||
            query.includes(tokenName.substring(3, 7)) ||
            query.includes(tokenSymbol.substring(3, 7))
          );
        })
        .sort((a, b) => new Date(b.expiry).getTime() - new Date(a.expiry).getTime()) // Sort by expiry
        .slice(0, 3)
        .map(token => token.name.replace(/^(PT|YT)\s+/, ''))
        .join(', ');
      
      const suggestion = similarTokens 
        ? `Could not find an active Pendle ${token_type.toUpperCase()} token matching "${tokenAddressOrName}" on chain ${chainId}. Did you mean one of these active tokens: ${similarTokens}? Please provide a valid token address or try a different token name.`
        : `Could not find an active Pendle ${token_type.toUpperCase()} token matching "${tokenAddressOrName}" on chain ${chainId}. Please provide a valid token address or try a different token name.`;
      
      throw new Error(suggestion);
    }
  }
  
  return { resolvedTokenAddress, resolvedMarketName };
}

const PENDLE_CONFIG = {
  // Ethereum Address Constants
  ETH_ADDRESS_IDENTIFIER: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  ETH_ADDRESS_PENDLE: '0x0000000000000000000000000000000000000000',
  ETH_SYMBOL: 'ETH',
  
  // Slippage Configuration
  DEFAULT_SLIPPAGE: 0.01,        // 1% default slippage
  DEMO_SLIPPAGE: 0.1,            // 10% slippage for demo mode
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
async function findMarketByTokenAddress(tokenAddress: string, tokenType: 'pt' | 'yt' | 'sy', chainId: number) {
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

  const networkConfig = getConfigByChainId(chainId || PENDLE_CONFIG.DEFAULT_CHAIN_ID, false);
  const nativeTokenSymbol = networkConfig.nativeAsset.symbol;

  // Determine tokenIn, tokenOut
  let tokenIn: string;
  let tokenOut: string;
  let inputToken: string;
  let outputToken: string;
  
  if (direction === 'ethToToken') {
    tokenIn = PENDLE_CONFIG.ETH_ADDRESS_PENDLE;
    tokenOut = tokenAddress;
    inputToken = nativeTokenSymbol;
    outputToken = fullTokenName;
  } else {
    tokenIn = tokenAddress;
    tokenOut = PENDLE_CONFIG.ETH_ADDRESS_PENDLE;
    inputToken = fullTokenName;
    outputToken = nativeTokenSymbol;
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
 * Helper function to get real-time gas estimation data
 * @param userWalletAddress User's wallet address
 * @param direction Swap direction
 * @param amountInHuman Human-readable amount
 * @param chainId Chain ID
 * @param isDemo Whether this is demo mode
 * @returns Real-time gas estimation data
 */
async function getRealTimeGasEstimation(
  userWalletAddress: string,
  direction: 'ethToToken' | 'tokenToEth',
  amountInHuman: string,
  chainId: number,
  isDemo: boolean
) {
  try {
    const { getGasPriceByChainId } = await import('../blocknative/get-gas-price');
    const provider = new ethers.JsonRpcProvider(
      getConfigByChainId(chainId, isDemo).rpcUrl
    );
    
    // Get current gas prices and user balance
    const [gasPrice, userBalance] = await Promise.all([
      getGasPriceByChainId(chainId),
      provider.getBalance(userWalletAddress)
    ]);
    
    // Estimate gas limit for Pendle swaps (typically 300k-500k)
    const estimatedGasLimit = BigInt(400000);
    const totalGasCost = estimatedGasLimit * gasPrice.maxFeePerGas;
    const transactionValue = direction === 'ethToToken' ? ethers.parseEther(amountInHuman) : BigInt(0);
    const totalRequired = totalGasCost + transactionValue;
    
    // Calculate values in ETH and USD (using approximate ETH price)
    const ethPrice = 3000;
    const totalGasCostEth = ethers.formatEther(totalGasCost);
    const totalGasCostUsd = (parseFloat(totalGasCostEth) * ethPrice).toFixed(2);
    const userBalanceEth = ethers.formatEther(userBalance);
    const userBalanceUsd = (parseFloat(userBalanceEth) * ethPrice).toFixed(2);
    const totalRequiredEth = ethers.formatEther(totalRequired);
    const totalRequiredUsd = (parseFloat(totalRequiredEth) * ethPrice).toFixed(2);
    
    const canProceed = userBalance >= totalRequired;
    const shortfall = canProceed ? BigInt(0) : totalRequired - userBalance;
    const shortfallEth = ethers.formatEther(shortfall);
    const shortfallUsd = (parseFloat(shortfallEth) * ethPrice).toFixed(2);
    
    return {
      networkFee: `${totalGasCostEth} ETH ($${totalGasCostUsd})`,
      userBalance: `${userBalanceEth} ETH ($${userBalanceUsd})`,
      required: `${totalRequiredEth} ETH ($${totalRequiredUsd})`,
      shortfall: `${shortfallEth} ETH ($${shortfallUsd})`,
      gasLimit: estimatedGasLimit.toString(),
      gasPrice: `${ethers.formatUnits(gasPrice.maxFeePerGas, 'gwei')} gwei`,
      maxFeePerGas: `${ethers.formatUnits(gasPrice.maxFeePerGas, 'gwei')} gwei`,
      estimationMethod: 'real-time',
      canProceed: canProceed
    };
  } catch (error) {
    console.error('Failed to get real-time gas estimation:', error);
    // Return error state instead of hardcoded values
    return {
      networkFee: 'Unable to estimate - network error',
      userBalance: 'Unable to fetch - network error',
      required: 'Unable to calculate - network error',
      shortfall: 'Unable to calculate - network error',
      gasLimit: '400000',
      gasPrice: 'Unable to fetch - network error',
      maxFeePerGas: 'Unable to fetch - network error',
      estimationMethod: 'error',
      canProceed: false
    };
  }
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

/**
 * Classify assets based on their risk profile and type
 * @param name Asset name (e.g., "sUSDe", "sENA", "rswETH")
 * @returns Asset classification with type and risk score
 */
function classifyAsset(name: string): {
  type: 'stablecoin' | 'stablecoin-synthetic' | 'yield-bearing' | 'volatile';
  isStablecoin: boolean;
  riskScore: number; // 1-10, lower = safer
  category: string;
} {
  const nameLower = name.toLowerCase();
  
  // True stablecoins (lowest risk)
  if ((nameLower.includes('usde') && !nameLower.includes('tusde')) || nameLower.includes('susde') || 
      nameLower.includes('usdc') || nameLower.includes('usdt') || 
      nameLower.includes('dai') || nameLower.includes('xusd') || 
      nameLower.includes('yusd') || nameLower.includes('usn') ||
      nameLower.includes('aidausdc') || nameLower.includes('midas') && nameLower.includes('usd')) {
    return {
      type: 'stablecoin',
      isStablecoin: true,
      riskScore: 1,
      category: 'Stablecoin'
    };
  }
  
  // Synthetic dollar assets (slightly higher risk)
  if (nameLower.includes('sena') || nameLower.includes('ena')) {
    return {
      type: 'stablecoin-synthetic',
      isStablecoin: false, // sENA is not a true stablecoin
      riskScore: 4,
      category: 'Synthetic Dollar'
    };
  }
  
  // Liquid staking tokens and yield-bearing assets
  if (nameLower.includes('steth') || nameLower.includes('wsteth') || 
      nameLower.includes('reth') || nameLower.includes('sweth') ||
      nameLower.includes('rseth') || nameLower.includes('rsweth') ||
      nameLower.includes('ezeth') || nameLower.includes('weeth') ||
      nameLower.includes('rlp')) {
    return {
      type: 'yield-bearing',
      isStablecoin: false,
      riskScore: 6,
      category: 'Yield-bearing ETH'
    };
  }
  
  // Default to volatile assets
  return {
    type: 'volatile',
    isStablecoin: false,
    riskScore: 8,
    category: 'Volatile Asset'
  };
}

/**
 * Enhanced sorting function that considers both yield and risk
 * Prioritizes: 1) Stablecoins, 2) High liquidity, 3) High APY, 4) Lower risk
 */
function createRecommendationScore(
  market: any,
  classification: ReturnType<typeof classifyAsset>
): number {
  let score = 0;
  
  // Base APY score (0-100)
  score += market.impliedApy * 100;
  
  // Stablecoin bonus (prioritize true stablecoins)
  if (classification.isStablecoin) {
    score += 50; // Big bonus for true stablecoins
  }
  
  // Liquidity bonus (logarithmic scale)
  const liquidityBonus = Math.log10(Math.max(market.liquidity, 1)) * 5;
  score += liquidityBonus;
  
  // Risk penalty (lower risk = higher score)
  const riskPenalty = (classification.riskScore - 1) * 2;
  score -= riskPenalty;
  
  return score;
}

export const pendleOpportunitiesTool = tool({
  description:
    'Get Pendle yield opportunities with intelligent stablecoin prioritization. This tool automatically renders UI.',
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
      ),
    stablecoins_only: z
      .boolean()
      .optional()
      .describe('If true, only return true stablecoins (USDC, USDT, DAI, sUSDe, etc.). Default false.'),
    exclude_stablecoins: z
      .boolean()
      .optional()
      .describe('If true, exclude all stablecoin pools and only show volatile/yield-bearing assets. Default false.'),
    sort_by: z
      .enum(['recommended', 'apy', 'liquidity', 'newest'])
      .default('recommended')
      .describe('Sort results by: "recommended" (smart scoring), "apy" (highest APY first), "liquidity" (highest liquidity first), or "newest" (latest pools first).')
  }),
  execute: async (params, context: ToolContext) => {
    const { max_results, apy_gte, apy_lte, stablecoins_only, exclude_stablecoins, sort_by } = params;
    const networkContext = context?.networkContext;
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required');
    }
    
    const chainId = networkContext.selectedChainId;
    
    try {
      const markets = await getPendleMarkets('active', chainId)

      // Convert percentage inputs to decimals if they are provided
      let decimal_apy_gte = undefined
      if (typeof apy_gte === 'number') {
        decimal_apy_gte = apy_gte / 100
      }

      let decimal_apy_lte = undefined
      if (typeof apy_lte === 'number') {
        decimal_apy_lte = apy_lte / 100
      }

      // Enhanced filtering with asset classification
      let filtered = markets.map(market => {
        const classification = classifyAsset(market.name);
        const recommendationScore = createRecommendationScore(market, classification);
        
        return {
          ...market,
          classification,
          recommendationScore
        };
      });

      // Apply APY filters
      if (decimal_apy_gte !== undefined)
        filtered = filtered.filter(o => o.impliedApy >= decimal_apy_gte!)
      if (decimal_apy_lte !== undefined)
        filtered = filtered.filter(o => o.impliedApy <= decimal_apy_lte!)
      
      // Apply stablecoin filters if requested
      if (stablecoins_only) {
        filtered = filtered.filter(o => o.classification.isStablecoin);
      } else if (exclude_stablecoins) {
        filtered = filtered.filter(o => !o.classification.isStablecoin);
      }

      // Sort based on user preference
      switch (sort_by) {
        case 'apy':
          filtered.sort((a, b) => b.impliedApy - a.impliedApy);
          break;
        case 'liquidity':
          filtered.sort((a, b) => b.liquidity - a.liquidity);
          break;
        case 'newest':
          // Sort by timestamp descending (newest first), fallback to APY if timestamps are equal
          filtered.sort((a, b) => {
            const timestampComparison = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            return timestampComparison !== 0 ? timestampComparison : b.impliedApy - a.impliedApy;
          });
          break;
        case 'recommended':
        default:
          // Sort by recommendation score (considers APY, liquidity, risk, and stablecoin status)
          filtered.sort((a, b) => b.recommendationScore - a.recommendationScore);
          break;
      }
      
      const results = filtered.slice(0, max_results);
      
      // Create summary with context about filtering and sorting
      let summary = `Found ${results.length} Pendle yield opportunities`;
      
      // Add sort context
      switch (sort_by) {
        case 'apy':
          summary += ' (sorted by APY)';
          break;
        case 'liquidity':
          summary += ' (sorted by liquidity)';
          break;
        case 'newest':
          summary += ' (sorted by newest pools first)';
          break;
        case 'recommended':
          summary += ' (smart recommendations)';
          break;
      }
      
      if (stablecoins_only) {
        summary += ', stablecoins only';
      } else if (exclude_stablecoins) {
        summary += ', excluding stablecoins';
      }
      
      const stablecoinCount = results.filter(r => r.classification.isStablecoin).length;
      if (stablecoinCount > 0 && !stablecoins_only && sort_by === 'recommended') {
        summary += ` - ${stablecoinCount} stablecoins prioritized`;
      }
      
      // Return minimal data for streaming, but include full data for UI
      return {
        _uiDisplayTool: true,
        summary,
        count: results.length,
        stablecoin_count: stablecoinCount,
        data: results
      }
    } catch (error: any) {
      console.log(error)
      const errorData = {
        error: error.message || 'Failed to get opportunities',
        max_results,
        apy_gte,
        apy_lte,
        stablecoins_only,
        exclude_stablecoins,
        sort_by
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
        getUsdSupportDescription('Amount of input token to swap in human-readable format (e.g., "1", "100.5"). Default to 1')
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
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required');
    }
    
    const chainId = networkContext.selectedChainId;
    
    // Parse USD amount if needed
    let actualAmountInHuman = amount_in_human;
    let usdConversionResult = null;
    
    // Determine the input token symbol for USD conversion
    let inputTokenSymbol = 'ETH'; // Default assumption for ethToToken direction
    
    if (direction === 'tokenToEth') {
      // The input token is not ETH, we need to infer it from the amount string
      // Try to detect token symbols in the amount string
      const possibleTokens = ['LINK', 'USDT', 'USDC', 'DAI', 'WBTC', 'UNI', 'AAVE', 'WETH'];
      const amountLower = amount_in_human.toLowerCase();
      
      for (const token of possibleTokens) {
        if (amountLower.includes(token.toLowerCase())) {
          inputTokenSymbol = token;
          break;
        }
      }
      
      // If no token detected in amount string but we're doing tokenToEth,
      // we can't reliably convert USD amounts without knowing the input token
      if (inputTokenSymbol === 'ETH' && amountLower.includes('$')) {
        console.log('Warning: USD amount detected for tokenToEth direction but input token unclear');
      }
    }
    
    try {
      usdConversionResult = await parseUsdAmount(amount_in_human, inputTokenSymbol, { 
        chainId, 
        throwErrors: false 
      });
      
      if (usdConversionResult.isUsd) {
        actualAmountInHuman = getEffectiveAmount(usdConversionResult);
        console.log(`USD Conversion: $${usdConversionResult.usdAmount} -> ${actualAmountInHuman} ${inputTokenSymbol}`);
      }
    } catch (error) {
      console.log('USD parsing error:', error);
      // Continue with original amount if USD parsing fails
    }
    
    try {
      const { resolvedTokenAddress, resolvedMarketName } = await resolveTokenAddress(
        tokenAddressOrName, 
        token_type, 
        networkContext?.selectedChainId!
      );
            
      const swapConfig = await prepareSwapConfiguration(
        resolvedTokenAddress,
        token_type,
        direction,
        actualAmountInHuman,
        resolvedMarketName || market_name,
        chainId
      );
      
      // Call the getSwapQuote function (handles anonymous users)
      const swapData = await getSwapQuote(
        swapConfig.marketAddress,
        swapConfig.tokenIn,
        swapConfig.tokenOut,
        swapConfig.amountInWei,
        PENDLE_CONFIG.DEFAULT_SLIPPAGE,
        PENDLE_CONFIG.ENABLE_AGGREGATOR,
        networkContext?.selectedChainId!,
        user_wallet_address || '0x0000000000000000000000000000000000000001'
      );

      const outputData = await formatSwapOutput(
        swapData,
        direction,
        resolvedTokenAddress,
        actualAmountInHuman,
        swapConfig.inputToken,
        swapConfig.outputToken,
        chainId
      );
      
      const priceImpactLevel = getPriceImpactLevel(swapData.priceImpact);
      const quoteData = {
        market: swapConfig.fullTokenName,
        inputAmount: actualAmountInHuman,
        inputToken: swapConfig.inputToken,
        outputToken: swapConfig.outputToken,
        rate: outputData.rate,
        inverse: outputData.inverse,
        outputAmount: outputData.outputAmountFormatted,
        priceImpact: swapData.priceImpact,
        priceImpactLevel: priceImpactLevel,
        priceImpactFormatted: `${swapData.priceImpact.toFixed(2)}%`,
        priceImpactWarning: priceImpactLevel === 'extreme' ? 
          `⚠️ EXTREME price impact (${swapData.priceImpact.toFixed(2)}%)! You may receive much less than expected.` :
          priceImpactLevel === 'high' ?
          `⚠️ High price impact (${swapData.priceImpact.toFixed(2)}%). Consider using a larger amount.` :
          null,
        complete_time: new Date().toISOString(),
        foundMarketAddress: swapConfig.marketAddress,
        foundTokenAddress: resolvedTokenAddress,
        usd_conversion: usdConversionResult?.isUsd ? {
          original_usd_amount: usdConversionResult.usdAmount,
          converted_token_amount: actualAmountInHuman,
          conversion_note: usdConversionResult.conversionNote
        } : null
      }
      
      const quoteSummary = priceImpactLevel === 'extreme' 
        ? `⚠️ Quote with EXTREME price impact (${swapData.priceImpact.toFixed(2)}%): ${outputData.rate}`
        : priceImpactLevel === 'high'
        ? `⚠️ Quote with high price impact (${swapData.priceImpact.toFixed(2)}%): ${outputData.rate}`
        : `Quote for ${outputData.rate}`;

      return {
        _uiDisplayTool: true,
        summary: quoteSummary,
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
      .describe('The name of the market (e.g. "rswETH"). Used for display purposes.'),
    confirmed_high_price_impact: z
      .boolean()
      .optional()
      .describe('Set to true if user has confirmed they want to proceed despite high price impact warning.'),
    confirmed_economic_warning: z
      .boolean()
      .optional()
      .describe('Set to true if user has confirmed they want to proceed despite the economic warning (gas costs > trade value).')
  }),
  execute: async (params, context: ToolContext) => {
    let {
      token_address,
      user_wallet_address,
      direction,
      token_type,
      amount_in_human,
      slippage = PENDLE_CONFIG.DEFAULT_SLIPPAGE,
      market_name,
      confirmed_high_price_impact = false,
      confirmed_economic_warning = false
    } = params;
    const networkContext = context?.networkContext;
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required');
    }
    
    const chainId = networkContext.selectedChainId;
    const isDemo = networkContext.isDemo || false;
    
    if (isDemo) {
      slippage = PENDLE_CONFIG.DEMO_SLIPPAGE
    }

    // Check if user has a valid wallet address for swap execution
    if (!user_wallet_address || !ethers.isAddress(user_wallet_address)) {
      return {
        _uiDisplayTool: true,
        summary: '🔐 Wallet connection required for swapping',
        data: {
          success: false,
          error: 'Please connect your wallet to execute swaps',
          error_category: 'Authentication Required',
          suggested_action: 'Connect your wallet and try again. You can still view quotes without connecting.',
          swap_parameters: {
            from: 'Unknown',
            to: 'Unknown',
            amount_in: `${amount_in_human}`,
            token_address,
            direction,
            amount_in_human,
            slippage
          }
        }
      };
    }

    let displayTokenIn, displayTokenOut;
    
    try {

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
      
      const { resolvedTokenAddress, resolvedMarketName } = await resolveTokenAddress(
        token_address, 
        token_type, 
        chainId
      );
      
      // Prepare swap configuration using helper function
      const swapConfig = await prepareSwapConfiguration(
        resolvedTokenAddress,
        token_type,
        direction,
        amount_in_human,
        resolvedMarketName || market_name,
        chainId
      );
      
      // Set display tokens for UI
      displayTokenIn = swapConfig.inputToken;
      displayTokenOut = swapConfig.outputToken;

      // First get a quote to check price impact (handles anonymous users)
      const quoteData = await getSwapQuote(
        swapConfig.marketAddress,
        swapConfig.tokenIn,
        swapConfig.tokenOut,
        swapConfig.amountInWei,
        slippage,
        PENDLE_CONFIG.ENABLE_AGGREGATOR,
        chainId,
        user_wallet_address || '0x0000000000000000000000000000000000000001'
      );

      // Check if price impact requires confirmation (unless already confirmed)
      const priceImpact = quoteData.priceImpact;
      const priceImpactLevel = getPriceImpactLevel(priceImpact);
      
      if (priceImpactLevel === 'extreme' && priceImpact > 15 && !confirmed_high_price_impact) {
        // Return confirmation request instead of executing immediately
        return {
          _uiDisplayTool: true,
          summary: `⚠️ High Price Impact Warning: ${priceImpact.toFixed(2)}%`,
          data: {
            requiresConfirmation: true,
            priceImpact: priceImpact,
            priceImpactFormatted: `${priceImpact.toFixed(2)}%`,
            warningLevel: 'extreme',
            warningMessage: `This swap has an extremely high price impact of ${priceImpact.toFixed(2)}%. You may receive significantly less tokens than expected.`,
            recommendations: [
              'Consider using a larger trade amount for better rates',
              'Try a different token pair with more liquidity',
              'Wait for better market conditions',
              'Only proceed if you understand the risks'
            ],
            swapDetails: {
              from: displayTokenIn,
              to: displayTokenOut,
              amountIn: `${amount_in_human} ${displayTokenIn}`,
              estimatedAmountOut: ethers.formatUnits(quoteData.amountOut, await getTokenDecimals(resolvedTokenAddress, chainId)),
              priceImpact: `${priceImpact.toFixed(2)}%`,
              slippage: `${(slippage * 100).toFixed(1)}%`
            },
            confirmationPrompt: `Do you want to proceed with this swap despite the ${priceImpact.toFixed(2)}% price impact?`,
            // Include all parameters needed to execute if user confirms
            executionParams: {
              token_address: resolvedTokenAddress,
              user_wallet_address,
              direction,
              token_type,
              input_token_name_display: displayTokenIn,
              output_token_name_display: displayTokenOut,
              amount_in_human,
              slippage,
              market_name: resolvedMarketName || market_name,
              confirmed_high_price_impact: true
            }
          }
        };
      }

      // If user confirmed high price impact, log it
      if (confirmed_high_price_impact && priceImpact > 15) {
        console.log(`User confirmed high price impact swap: ${priceImpact.toFixed(2)}%`);
      }

      // Get transaction data for gas estimation (like MetaMask does)
      console.log('Getting transaction data for gas estimation...');
      let txData;
      let transactionPreview;
      
      try {
        txData = await getPendleSwapTransactionData(
          swapConfig.marketAddress,
          swapConfig.tokenIn,
          swapConfig.tokenOut,
          swapConfig.amountInWei,
          slippage,
          PENDLE_CONFIG.ENABLE_AGGREGATOR,
          chainId,
          user_wallet_address
        );

        // Create transaction preview with gas estimation
        transactionPreview = await createTransactionPreview(
          {
            to: txData.to,
            from: txData.from,
            data: txData.data,
            value: txData.value
          },
          chainId,
          isDemo
        );

        // If insufficient balance, return detailed error like MetaMask would show
        if (!transactionPreview.canProceed) {
          return {
          _uiDisplayTool: true,
          summary: `❌ Insufficient funds for swap`,
          data: {
            success: false,
            error: 'Insufficient ETH balance to cover gas fees',
            error_category: 'Insufficient Balance (Gas Fees)',
            gasEstimation: {
              networkFee: `${transactionPreview.gasEstimate.totalGasCostEth} ETH ($${transactionPreview.gasEstimate.totalGasCostUsd})`,
              userBalance: `${transactionPreview.gasEstimate.userBalanceEth} ETH ($${transactionPreview.gasEstimate.userBalanceUsd})`,
              required: `${transactionPreview.totalRequiredEth} ETH ($${transactionPreview.totalRequiredUsd})`,
              shortfall: `${transactionPreview.gasEstimate.shortfallEth} ETH ($${transactionPreview.gasEstimate.shortfallUsd})`,
              gasLimit: transactionPreview.gasEstimate.gasLimit.toString(),
              gasPrice: transactionPreview.gasEstimate.gasPrice > 0 ? 
                `${ethers.formatUnits(transactionPreview.gasEstimate.gasPrice, 'gwei')} gwei` : 
                `${ethers.formatUnits(transactionPreview.gasEstimate.maxFeePerGas || BigInt(0), 'gwei')} gwei`,
              estimationMethod: transactionPreview.gasEstimate.estimationMethod
            },
            detailedMessage: `Network fee: ${transactionPreview.gasEstimate.totalGasCostEth} ETH ($${transactionPreview.gasEstimate.totalGasCostUsd})\nYour balance: ${transactionPreview.gasEstimate.userBalanceEth} ETH ($${transactionPreview.gasEstimate.userBalanceUsd})\nYou need ${transactionPreview.gasEstimate.shortfallEth} ETH ($${transactionPreview.gasEstimate.shortfallUsd}) more`,
            suggested_action: `Add at least ${transactionPreview.gasEstimate.shortfallEth} ETH ($${transactionPreview.gasEstimate.shortfallUsd}) to your wallet, or wait for lower gas prices.`,
            swap_parameters: {
              from: displayTokenIn,
              to: displayTokenOut,
              amount_in: `${amount_in_human} ${displayTokenIn}`,
              token_address: resolvedTokenAddress,
              direction,
              amount_in_human,
              slippage
            }
          }
        };
      }

      // Show gas preview if it's high (like MetaMask warning)  
      if (transactionPreview && transactionPreview.warningMessage) {
        console.warn('Gas cost warning:', transactionPreview.warningMessage);
      }

      } catch (gasEstimationError: any) {
        console.warn('Failed to get transaction data for gas estimation:', gasEstimationError);
        
        // In demo mode, check if we should offer educational failure explanation
        if (isDemo) {
          const { shouldOfferDemoSimulation, createDemoFailureResponse } = await import('../utils/demo-transaction-handler');
          
          // Try to extract revert reason from the error
          let revertReason = null;
          if (gasEstimationError.message?.includes('custom error 0x72294811')) {
            revertReason = 'Market conditions changed - insufficient liquidity or price impact too high';
          } else if (gasEstimationError.message?.includes('execution reverted')) {
            revertReason = gasEstimationError.message;
          }
          
          if (revertReason && shouldOfferDemoSimulation(revertReason, isDemo)) {
            console.log('🎭 Demo mode: Offering educational failure explanation with optional simulation');
            
            // Get basic gas estimation for educational purposes
            const { robustGasEstimation } = await import('../utils/robust-gas-estimation');
            const basicTxData = {
              to: '0x888888888889758F76e7103c6CbF23ABbF58F946',
              from: user_wallet_address,
              data: '0x',
              value: direction === 'ethToToken' ? ethers.parseEther(amount_in_human).toString() : '0'
            };
            
            const gasEstimate = await robustGasEstimation(basicTxData, chainId, isDemo);
            
            const demoResponse = createDemoFailureResponse(revertReason, basicTxData, {
              gasLimit: gasEstimate.gasLimit,
              totalGasCostEth: gasEstimate.totalGasCostEth,
              totalGasCostUsd: gasEstimate.totalGasCostUsd,
              maxFeePerGas: gasEstimate.maxFeePerGas,
              gasPrice: gasEstimate.gasPrice
            });
            
            return {
              _uiDisplayTool: true,
              summary: `🎓 Demo: Transaction would fail - ${demoResponse.explanation.title}`,
              data: {
                isDemoEducational: true,
                ...demoResponse,
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
            };
          }
        }
        
        // METAMASK-STYLE APPROACH: Show gas estimation even if transaction might fail
        // Don't block users - give them transparency to make their own decision
        
        // Always try to provide gas cost information like MetaMask does
        let gasEstimationData = null;
        try {
          const fallbackTxData = {
            to: '0x888888888889758F76e7103c6CbF23ABbF58F946', // Pendle RouterV4
            from: user_wallet_address,
            data: '0x',
            value: direction === 'ethToToken' ? ethers.parseEther(amount_in_human).toString() : '0'
          };
          
          const fallbackPreview = await createTransactionPreview(fallbackTxData, chainId, isDemo);
          gasEstimationData = {
            networkFee: `${fallbackPreview.gasEstimate.totalGasCostEth} ETH ($${fallbackPreview.gasEstimate.totalGasCostUsd})`,
            userBalance: `${fallbackPreview.gasEstimate.userBalanceEth} ETH ($${fallbackPreview.gasEstimate.userBalanceUsd})`,
            required: `${fallbackPreview.totalRequiredEth} ETH ($${fallbackPreview.totalRequiredUsd})`,
            shortfall: fallbackPreview.canProceed ? '0 ETH ($0)' : `${fallbackPreview.gasEstimate.shortfallEth} ETH ($${fallbackPreview.gasEstimate.shortfallUsd})`,
            gasLimit: fallbackPreview.gasEstimate.gasLimit.toString(),
            gasPrice: fallbackPreview.gasEstimate.gasPrice > 0 ? 
              `${ethers.formatUnits(fallbackPreview.gasEstimate.gasPrice, 'gwei')} gwei` : 
              `${ethers.formatUnits(fallbackPreview.gasEstimate.maxFeePerGas || BigInt(0), 'gwei')} gwei`,
            estimationMethod: 'fallback',
            canProceed: fallbackPreview.canProceed,
            maxFeePerGas: fallbackPreview.gasEstimate.maxFeePerGas ? 
              ethers.formatUnits(fallbackPreview.gasEstimate.maxFeePerGas, 'gwei') : null
          };
        } catch (fallbackError) {
          console.warn('Could not get gas estimation:', fallbackError);
          gasEstimationData = await getRealTimeGasEstimation(
            user_wallet_address,
            direction,
            amount_in_human,
            chainId,
            isDemo
          );
        }
        
        // Check if this is an economically unviable trade (like MetaMask would show)
        const tradeValueUsd = parseFloat(amount_in_human) * 3000; // Approximate ETH price
        const gasCostUsd = parseFloat(gasEstimationData.networkFee.match(/\$(\d+\.\d+)/)?.[1] || '10');
        const isEconomicallyUnviable = tradeValueUsd < gasCostUsd * 0.1; // Gas cost > 10x trade value
        
        // Show MetaMask-style transparency with economic warning (unless already confirmed)
        if (isEconomicallyUnviable && !confirmed_economic_warning) {
          return {
            _uiDisplayTool: true,
            summary: `⚠️ High gas cost warning for small trade`,
            data: {
              requiresConfirmation: true,
              warningType: 'economical',
              tradeDetails: {
                amount: `${amount_in_human} ETH`,
                tradeValue: `$${tradeValueUsd.toFixed(2)}`,
                gasEstimation: gasEstimationData,
                gasCostVsTradeValue: `${(gasCostUsd / tradeValueUsd).toFixed(1)}x`,
                economicallyViable: false
              },
              warningMessage: `This trade will cost approximately ${gasEstimationData.networkFee} in gas fees for a $${tradeValueUsd.toFixed(2)} transaction. You will lose money on this trade.`,
              recommendations: [
                'Consider increasing your trade amount to at least 0.01 ETH ($30)',
                'Wait for lower gas prices during off-peak hours',
                'Use a Layer 2 solution if available',
                'Only proceed if you understand you will lose money'
              ],
              detailedMessage: `Trade amount: ${amount_in_human} ETH ($${tradeValueUsd.toFixed(2)})\nNetwork fee: ${gasEstimationData.networkFee}\nYour balance: ${gasEstimationData.userBalance}\nNet result: You will lose ~$${(gasCostUsd - tradeValueUsd).toFixed(2)}`,
              confirmationPrompt: 'Do you want to proceed with this uneconomical trade anyway?',
              executionParams: {
                token_address,
                user_wallet_address,
                direction,
                token_type,
                input_token_name_display: displayTokenIn,
                output_token_name_display: displayTokenOut,
                amount_in_human,
                slippage,
                market_name,
                confirmed_economic_warning: true
              }
            }
          };
        }
        
        // If still insufficient balance after gas estimation, show that error
        if (gasEstimationData && gasEstimationData.canProceed === false) {
          // Extract shortfall amount more carefully
          const shortfallMatch = gasEstimationData.shortfall?.match(/(\d+\.?\d*)\s*ETH/);
          const shortfallAmount = shortfallMatch ? shortfallMatch[1] : 'some';
          
          return {
            _uiDisplayTool: true,
            summary: `❌ Insufficient funds for swap`,
            data: {
              success: false,
              error: 'Insufficient ETH balance to cover gas fees',
              error_category: 'Insufficient Balance (Gas Fees)',
              gasEstimation: gasEstimationData,
              detailedMessage: `Network fee: ${gasEstimationData.networkFee}\nYour balance: ${gasEstimationData.userBalance}\nShortfall: ${gasEstimationData.shortfall}`,
              suggested_action: `Add at least ${shortfallAmount} ETH to your wallet or wait for lower gas prices.`,
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
          };
        }
        
        // MetaMask-style: Continue to execution even if gas estimation failed
        // User has been informed about potential costs and can proceed
        console.log('⚠️ Gas estimation failed but continuing to execution (MetaMask-style transparency)');
      }

      // Price impact is acceptable or confirmed, and balance is sufficient - proceed with execution
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

      const explorerLink = getConfigByChainId(chainId, isDemo).scanLink
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

      const summaryMessage = confirmed_high_price_impact && priceImpact > 15
        ? `⚠️ High impact swap executed: ${amount_in_human} ${displayTokenIn} → ${displayTokenOut} (${priceImpact.toFixed(2)}% impact)`
        : `Swap executed: ${amount_in_human} ${displayTokenIn} → ${displayTokenOut}`;

      return {
        _uiDisplayTool: true,
        summary: summaryMessage,
        data: {
          ...swapData,
          priceImpact: priceImpact,
          priceImpactLevel: priceImpactLevel,
          confirmedHighImpact: confirmed_high_price_impact,
          gasEstimation: transactionPreview ? {
            networkFee: `${transactionPreview.gasEstimate.totalGasCostEth} ETH ($${transactionPreview.gasEstimate.totalGasCostUsd})`,
            gasLimit: transactionPreview.gasEstimate.gasLimit.toString(),
            estimationMethod: transactionPreview.gasEstimate.estimationMethod
          } : null
        }
      }
    } catch (error: any) {
      console.log(error)
      
      // ALWAYS provide gas estimation in error cases (MetaMask-style transparency)
      let gasEstimationData = null;
      try {
        const fallbackTxData = {
          to: '0x888888888889758F76e7103c6CbF23ABbF58F946', // Pendle RouterV4
          from: user_wallet_address,
          data: '0x', // Empty data for basic estimation
          value: direction === 'ethToToken' ? ethers.parseEther(amount_in_human).toString() : '0'
        };

        const fallbackPreview = await createTransactionPreview(fallbackTxData, chainId, isDemo);
        
        // Always provide gas estimation, regardless of balance sufficiency
        gasEstimationData = {
          networkFee: `${fallbackPreview.gasEstimate.totalGasCostEth} ETH ($${fallbackPreview.gasEstimate.totalGasCostUsd})`,
          userBalance: `${fallbackPreview.gasEstimate.userBalanceEth} ETH ($${fallbackPreview.gasEstimate.userBalanceUsd})`,
          required: `${fallbackPreview.totalRequiredEth} ETH ($${fallbackPreview.totalRequiredUsd})`,
          shortfall: fallbackPreview.canProceed ? '0 ETH ($0)' : `${fallbackPreview.gasEstimate.shortfallEth} ETH ($${fallbackPreview.gasEstimate.shortfallUsd})`,
          gasLimit: fallbackPreview.gasEstimate.gasLimit.toString(),
          gasPrice: fallbackPreview.gasEstimate.gasPrice > 0 ? 
            `${ethers.formatUnits(fallbackPreview.gasEstimate.gasPrice, 'gwei')} gwei` : 
            `${ethers.formatUnits(fallbackPreview.gasEstimate.maxFeePerGas || BigInt(0), 'gwei')} gwei`,
          maxFeePerGas: fallbackPreview.gasEstimate.maxFeePerGas ? 
            `${ethers.formatUnits(fallbackPreview.gasEstimate.maxFeePerGas, 'gwei')} gwei` : null,
          estimationMethod: 'fallback',
          canProceed: fallbackPreview.canProceed
        };
      } catch (gasError) {
        console.warn('Could not get gas estimation, using real-time fallback:', gasError);
        gasEstimationData = await getRealTimeGasEstimation(
          user_wallet_address,
          direction,
          amount_in_human,
          chainId,
          isDemo
        );
      }
      
      // Extract more detailed error information
      let errorReason = error.message || 'Failed to execute Pendle swap.';
      let errorCategory = 'Unknown';
      let suggestedAction = '';
      
      // If we have gas estimation showing insufficient balance, override the error
      if (gasEstimationData) {
        errorReason = 'Insufficient ETH balance to cover gas fees';
        errorCategory = 'Insufficient Balance (Gas Fees)';
        suggestedAction = `Add at least ${gasEstimationData.shortfall} to your wallet, or wait for lower gas prices.`;
      } else {
      
      if (errorReason.includes('Gas fees') && errorReason.includes('exceed your balance')) {
        errorCategory = 'Insufficient Balance (Gas Fees)';
        suggestedAction = 'Gas prices are very high right now. Wait for lower gas prices or add more ETH to your wallet.';
      } else if (errorReason.includes('insufficient balance')) {
        errorCategory = 'Insufficient Balance';
        suggestedAction = 'Please ensure you have enough ETH in your wallet.';
      } else if (errorReason.includes('slippage') || errorReason.includes('SLIPPAGE_EXCEEDED')) {
        errorCategory = 'Slippage Too Low';
        suggestedAction = 'Try increasing slippage tolerance to 2-5%.';
      } else if (errorReason.includes('Extremely high price impact') || errorReason.includes('price impact')) {
        errorCategory = 'High Price Impact';
        suggestedAction = 'Try using a larger trade amount for better rates, or choose a different token pair with more liquidity.';
      } else if (errorReason.includes('Transaction was mined but reverted') || errorReason.includes('Transaction reverted')) {
        errorCategory = 'Transaction Reverted';
        if (errorReason.includes('slippage')) {
          suggestedAction = 'Increase slippage tolerance to 2-5% or wait for more stable market conditions.';
        } else if (errorReason.includes('deadline') || errorReason.includes('EXPIRED')) {
          suggestedAction = 'Try the transaction again - market conditions changed during execution.';
        } else if (errorReason.includes('output amount')) {
          suggestedAction = 'Price moved against you during execution. Try again with higher slippage tolerance.';
        } else {
          suggestedAction = 'Transaction failed during execution. Check token balances and try again with different parameters.';
        }
      } else if (errorReason.includes('gas')) {
        errorCategory = 'Gas Issue';
        suggestedAction = 'Network congestion detected. Try again when gas prices are lower.';
      } else if (errorReason.includes('Transaction validation failed')) {
        errorCategory = 'Transaction Validation';
        suggestedAction = 'Check if the token pair is available for trading with the requested amount.';
      } else if (errorReason.includes('network') || errorReason.includes('connection')) {
        errorCategory = 'Network Error';
        suggestedAction = 'Please check your internet connection and try again.';
      }
      } // Close the else block from gas estimation check
      
      const errorData = {
        success: false,
        error: errorReason,
        error_category: errorCategory,
        suggested_action: suggestedAction,
        gasEstimation: gasEstimationData,
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
        summary: `Swap failed (${errorCategory}): ${errorReason}`,
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
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required');
    }
    
    const chainId = networkContext.selectedChainId;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt', chainId);
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
      .describe(
        getUsdSupportDescription('Amount of input tokens to mint from in human-readable format (e.g., "1", "100.5").')
      ),
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
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required');
    }
    
    const chainId = networkContext.selectedChainId;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt', chainId);
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
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required');
    }
    
    const chainId = networkContext.selectedChainId;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt', chainId);
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
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required');
    }
    
    const chainId = networkContext.selectedChainId;

    try {
      // Find the market using PT address to get all required addresses
      const foundMarket = await findMarketByTokenAddress(pt_address, 'pt', chainId);
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

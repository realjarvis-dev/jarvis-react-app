import { tool } from 'ai'
import { z } from 'zod'
import {
  executeLifiBridgeTransaction,
  // executeLifiBridgeTransactionWithAutoFuel,
  generateLifiBridgeQuote
} from '../lifi/actions'
import { getTokenUsdPriceBatch } from '../enso/get-token-usd-price'
import { getUserEvmWalletAddress } from '../privy/client'
import { chainsById } from '../token-matcher/fuzzy-chain-matcher'
import { ToolContext } from '../types/context'
import { bus } from '../pubsub/simple-pubsub'
import { getUserId } from '../privy/client'
import { balanceChangePub } from '../pubsub/balance-change-pub'
import { ChainType } from '../network/types'

// Token address mapping for USD conversion (matching other tools)
const tokenAddressMap: Record<string, string> = {
  ETH: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
  UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  AAVE: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  MKR: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
  COMP: '0xc00e94cb662c3520282e6f5717214004a7f26888'
}

const tokenDecimalMap: Record<string, number> = {
  ETH: 18,
  USDT: 6,
  USDC: 6,
  DAI: 18,
  WETH: 18,
  WBTC: 8,
  LINK: 18,
  UNI: 18,
  AAVE: 18,
  MKR: 18,
  COMP: 18,
}

// Helper function to parse USD amounts and convert to any token for LiFi bridge
async function parseUsdAmountForBridge(amountStr: string, tokenSymbol: string, chainId: number): Promise<{ isUsd: boolean; tokenAmount?: string; usdAmount?: number }> {
  const usdPatterns = [
    /^\$(\d+(?:\.\d+)?)$/, // $30, $100.50
    /^(\d+(?:\.\d+)?)\s*usd$/i, // 30 USD, 100.50 usd
    /^(\d+(?:\.\d+)?)\s*dollars?$/i, // 30 dollars, 100.50 dollar
    /^\$(\d+(?:\.\d+)?)\s+(?:of|worth\s+of|in)\s+/i, // $100 of token, $100 worth of token, $100 in token
    /^(\d+(?:\.\d+)?)\s*(?:usd|dollars?)\s+(?:of|worth\s+of|in)\s+/i, // 100 USD of token, 100 dollars worth of token
  ];
  
  for (const pattern of usdPatterns) {
    const match = amountStr.trim().match(pattern);
    if (match) {
      const usdAmount = parseFloat(match[1]);
      if (isNaN(usdAmount) || usdAmount <= 0) {
        throw new Error(`Invalid USD amount: ${amountStr}`);
      }
      
      // Get token address for price lookup
      const tokenAddress = tokenAddressMap[tokenSymbol.toUpperCase()];
      if (!tokenAddress) {
        throw new Error(`Token ${tokenSymbol} is not supported for USD conversion`);
      }
      
      try {
        const priceData = await getTokenUsdPriceBatch([tokenAddress], chainId);
        if (!priceData || priceData.length === 0) {
          throw new Error(`Market data unavailable for ${tokenSymbol}. Please specify the exact token amount instead of USD amount.`);
        }
        
        const tokenPrice = priceData[0].price;
        if (!tokenPrice || tokenPrice <= 0) {
          throw new Error(`Market data unavailable for ${tokenSymbol}. Please specify the exact token amount instead of USD amount.`);
        }
        
        const tokenDecimals = tokenDecimalMap[tokenSymbol.toUpperCase()] || 18;
        const tokenAmount = (usdAmount / tokenPrice).toFixed(tokenDecimals);
        
        return {
          isUsd: true,
          tokenAmount: tokenAmount,
          usdAmount: usdAmount
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('Market data unavailable')) {
          throw error; // Re-throw market data unavailable errors
        }
        throw new Error(`Failed to fetch ${tokenSymbol} price for USD conversion: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  return { isUsd: false };
}

const bridgeQuoteTool = tool({
  description:
    "Get a quote for a cross-chain bridge transfer from user's wallet. can also be single chain swap. It automatically renders UI on success.",
  parameters: z.object({
    fromChain: z
      .string()
      .describe(
        "The chain to bridge from, can be chain name or chain symbol. don't have to be exact match. Default to network context's network as fromChain unless user specify"
      ),
    toChain: z
      .string()
      .describe(
        "The chain to bridge to, can be chain name or chain symbol. don't have to be exact match. Default to network context's network as toChain unless user specify"
      ),
    fromToken: z
      .string()
      .describe(
        "The token to bridge from, can be token symbol or token name. don't have to be exact match"
      ),
    toToken: z
      .string()
      .describe(
        "The token to bridge to, can be token symbol or token name. don't have to be exact match"
      ),
    amountIn: z
      .string()
      .describe(
        'The amount of input tokens to bridge, in human readable format. Also supports USD amounts in various formats: "$30", "$100", "30 USD", "$100 of token", "$100 worth of token", "100 USD of token" - the system will automatically convert to the token amount using real-time market prices. If market data is unavailable for a token, the system will inform the user to specify the exact token amount instead.'
      ),
    slippage: z
      .string()
      .default('0.005')
      .describe(
        'The slippage tolerance for the transaction, 0.005 represents 0.5% slippage. Default to 0.005'
      ),
    recipient: z
      .string()
      .optional()
      .describe(
        "The address to send the bridged tokens to. Default to user's wallet address"
      ),
    // diable for now
    // enableAutoFuel: z.boolean().describe('Whether to auto fuel the destination chain when the native balance is low, default to true')
  }),
  execute: async (params, context: ToolContext) => {
    let {fromChain, toChain, fromToken, toToken, amountIn, slippage, recipient } = params
    // const fromChain = context?.networkContext?.selectedNetwork || 'ethereum'
    const fromChainInContext = context?.networkContext?.selectedNetwork
    // if (fromChainInContext?.toLowerCase() === 'demo') {
    //   fromChain = 'Ethereum'
    //   if (toChain.toLowerCase() === 'demo') {
    //     toChain = 'Ethereum'
    //   }
    // }
    const isDemo = context?.networkContext?.isDemo
    
    // Handle USD amount conversion for fromToken
    let actualAmountIn = amountIn
    let usdConversionInfo: { isUsd: boolean; tokenAmount?: string; usdAmount?: number } | null = null
    
    try {
      // Try to parse USD amount and convert to token amount
      const chainId = context?.networkContext?.selectedChainId || 1 // Default to Ethereum mainnet
      usdConversionInfo = await parseUsdAmountForBridge(amountIn, fromToken, chainId)
      if (usdConversionInfo.isUsd) {
        actualAmountIn = usdConversionInfo.tokenAmount!
        console.log(`USD Conversion: $${usdConversionInfo.usdAmount} -> ${actualAmountIn} ${fromToken.toUpperCase()}`)
      }
    } catch (error) {
      // If USD parsing fails, return error with helpful message
      return {
        _uiDisplayTool: true,
        summary: `USD conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
    
    console.log('fromChain', fromChain)
    console.log('toChain', toChain)
    console.log('fromToken', fromToken)
    console.log('toToken', toToken)
    console.log('original amountIn', amountIn)
    console.log('actual amountIn', actualAmountIn)
    console.log('slippage', slippage)
    console.log('recipient', recipient)
    const userEvmAddress = await getUserEvmWalletAddress()
    if (!userEvmAddress) {
      return {
        instruction: 'notify user',
        details: "User's embedded wallet not found"
      }
    }
    if (isDemo) {
      slippage = '0.3'
      fromChain = 'Ethereum'
      toChain = 'Ethereum'
    }
    const result = await generateLifiBridgeQuote(
      fromChain,
      toChain,
      fromToken,
      toToken,
      userEvmAddress,
      actualAmountIn,
      slippage,
      recipient,
      false
    )
    
    // Add USD conversion info to the result if applicable
    if (result && typeof result === 'object' && usdConversionInfo?.isUsd) {
      return {
        ...result,
        usd_conversion: {
          original_usd_amount: usdConversionInfo.usdAmount,
          converted_token_amount: actualAmountIn,
          conversion_note: `Converted $${usdConversionInfo.usdAmount} to ${actualAmountIn} ${fromToken.toUpperCase()} using real-time pricing`
        }
      }
    }
    
    return result
  }
})

const bridgeExecuteTool = tool({
  description:
    "Execute a cross-chain bridge transfer from user's wallet. can also be single chain swap. This tool should be used after the user has confirmed the quote.",
  parameters: z.object({
    fromChainId: z.number().describe('The chain id to bridge from'),
    fromChainName: z.string().describe('The name of the chain to bridge from'),
    fromToken: z
      .string()
      .describe('The token to bridge from, has to be exact match'),
    fromTokenDecimals: z.number().describe('The decimals of the input token'),
    fromTokenAddress: z.string().describe('The address of the input token'),
    isFromNativeToken: z
      .boolean()
      .describe(
        'Whether the input token is the native token of the from chain'
      ),
    toChainId: z.number().describe('The chain id to bridge to'),
    toChainName: z.string().describe('The name of the chain to bridge to'),
    toToken: z
      .string()
      .describe('The token to bridge to, has to be exact match'),
    amountIn: z
      .string()
      .describe(
        'The amount of input tokens to bridge, in human readable format'
      ),
    slippage: z
      .string()
      .default('0.005')
      .describe(
        'The slippage tolerance for the transaction, 0.005 represents 0.5% slippage. Default to 0.005'
      ),
    recipient: z
      .string()
      .optional()
      .describe(
        "The address to send the bridged tokens to. Default to user's wallet address"
      ),
    // autoFuel: z.boolean().describe('Whether to auto fuel the destination chain, decision made by quote tool')
  }),

  execute: async ({
    fromChainId,
    fromToken,
    fromTokenDecimals,
    fromTokenAddress,
    toChainId,
    toToken,
    amountIn,
    slippage,
    recipient,
    isFromNativeToken,
    fromChainName,
    toChainName,
    // autoFuel
  }, context: ToolContext) => {
    const fromChainIdInContext = context?.networkContext?.selectedChainId
    // if (fromChainId.toString() !== fromChainIdInContext?.toString()) {
    //   return {
    //     instruction: 'notify user',
    //     details: "Please use the correct fromChain for the tool, or switch to the correct network"
    //   }
    // }
    const userEvmAddress = await getUserEvmWalletAddress()
    if (!userEvmAddress) {
      return {
        instruction: 'notify user',
        details: "User's embedded wallet not found"
      }
    }
    const isDemo = context?.networkContext?.isDemo
    if (isDemo) {
      slippage = '0.3'
    }
    
    const result =  await executeLifiBridgeTransaction(
      userEvmAddress,
      fromChainId,
      fromToken,
      fromTokenDecimals,
      fromTokenAddress,
      toChainId,
      toToken,
      amountIn,
      slippage,
      recipient,
      isFromNativeToken,
      fromChainName,
      toChainName,
      isDemo
    )
    const userId = await getUserId()
    balanceChangePub(userId, [fromChainId.toString() as ChainType, toChainId.toString() as ChainType], isDemo || false)
    return result
  }
})

export { bridgeExecuteTool, bridgeQuoteTool }



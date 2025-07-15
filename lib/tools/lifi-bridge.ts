import { tool } from 'ai'
import { z } from 'zod'
import {
  executeLifiBridgeTransaction,
  // executeLifiBridgeTransactionWithAutoFuel,
  generateLifiBridgeQuote
} from '../lifi/actions'
import { parseUsdAmount, getUsdSupportDescription, createUsdConversionInfo, getEffectiveAmount } from '../utils/usd-parser'
import { getUserEvmWalletAddress, getUserSolWalletAddress } from '../privy/client'
import { ToolContext } from '../types/context'
import { getUserId } from '../privy/client'
import { balanceChangePub } from '../pubsub/balance-change-pub'
import { ChainType } from '../network/types'
import { LIFI_SOLANA_CHAIN_ID } from '../token-matcher/token-utils'
import { getConfigByChainId } from '../network/config'


const bridgeQuoteTool = tool({
  description:
    `Get a quote for a cross-chain bridge transfer from user's wallet. can also be single chain swap. 
    When bridging to Solana, user can only bridge to USDC, USDT, or SOL on Solana.
    You must ask user whether they prefer fastest or cheapest route. It automatically renders UI on success.`,
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
        getUsdSupportDescription('The amount of input tokens to bridge, in human readable format.')
      ),
    slippage: z
      .string()
      .default('0.005')
      .describe(
        'The slippage tolerance for the transaction, 0.005 represents 0.5% slippage. Default to 0.005'
      ),
    preference: z
      .enum(['FASTEST', 'CHEAPEST'])
      .describe(
        'The preference for the transaction, FASTEST represents the fastest route, CHEAPEST represents the cheapest route. Ask user their preference.'
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
    try {

    
    let {fromChain, toChain, fromToken, toToken, amountIn, slippage, recipient, preference } = params

    const isDemo = context?.networkContext?.isDemo
    
    // Parse USD amount using common utility
    const chainId = context?.networkContext?.selectedChainId || 1 // Default to Ethereum mainnet
    const usdConversionResult = await parseUsdAmount(amountIn, fromToken, { 
      chainId, 
      throwErrors: false // Return errors in result instead of throwing
    })
    
    // Check for conversion errors
    if (usdConversionResult.conversionNote && !usdConversionResult.isUsd) {
      return {
        _uiDisplayTool: true,
        summary: `USD conversion failed: ${usdConversionResult.conversionNote}`,
        data: { error: usdConversionResult.conversionNote }
      }
    }
    
    const actualAmountIn = getEffectiveAmount(usdConversionResult)
    
    if (usdConversionResult.isUsd) {
      console.log(`USD Conversion: $${usdConversionResult.usdAmount} -> ${actualAmountIn} ${fromToken.toUpperCase()}`)
    }
    let fromUserAddress;
    let toUserAddress = recipient;
    if (!toUserAddress && toChain.toLowerCase() === "solana") {
      toUserAddress = await getUserSolWalletAddress()
    } else {
      toUserAddress = await getUserEvmWalletAddress()
    }
    if (fromChain.toLowerCase() === "solana") {
      fromUserAddress = await getUserSolWalletAddress()
    } else {
      fromUserAddress = await getUserEvmWalletAddress()
    }
    if (!fromUserAddress || !toUserAddress) {
      return {
        instruction: 'notify user',
        details: "User's embedded wallet not found"
      }
    }
    if (isDemo) {
      slippage = '0.3'
      // fromChain = 'Ethereum'
      // toChain = 'Ethereum'
    }
    if (Number(actualAmountIn) < 0.002) {
      throw Error("Sorry, the amount is too small to bridge. Can you try again with a larger amount?")
    }
    const result = await generateLifiBridgeQuote(
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromUserAddress,
      actualAmountIn,
      slippage,
      toUserAddress,
      false,
      preference
    )
    
    // Add USD conversion info to the result if applicable
    if (result && typeof result === 'object' && usdConversionResult.isUsd) {
      return {
        ...result,
        usd_conversion: createUsdConversionInfo(usdConversionResult)
      }
    }
    
    return result
    } catch (error) {
      console.error(error)
    return {
      _uiDisplayTool: true,
      summary: `Error generating quote: ${error instanceof Error ? error.message : "Unknown error"}`,
      data: { error: error instanceof Error ? error.message : "Unknown error" }
    }
  }
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
    preference: z
      .enum(['FASTEST', 'CHEAPEST'])
      .describe(
        'The preference for the transaction, FASTEST represents the fastest route, CHEAPEST represents the cheapest route. '
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
    preference,
    // autoFuel
  }, context: ToolContext) => {
    try {
    let fromUserAddress;
    let toUserAddress = recipient;
    if (!toUserAddress) {
      if (toChainId === LIFI_SOLANA_CHAIN_ID) {
        toUserAddress = await getUserSolWalletAddress()
      } else {
        toUserAddress = await getUserEvmWalletAddress()
      }
    } 

    fromUserAddress = await getUserEvmWalletAddress()
    if (!fromUserAddress || !toUserAddress) {
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
      fromUserAddress,
      fromChainId,
      fromToken,
      fromTokenDecimals,
      fromTokenAddress,
      toChainId,
      toToken,
      amountIn,
      slippage,
      toUserAddress,
      isFromNativeToken,
      fromChainName,
      toChainName,
      isDemo,
      preference
    )
    const userId = await getUserId()
    const toChainType = getConfigByChainId(toChainId, false).id
    balanceChangePub(userId, [context.networkContext?.selectedNetwork as ChainType, toChainType], isDemo || false)
    return result
    } catch (error) {
      console.error(error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }
})

export { bridgeExecuteTool, bridgeQuoteTool }



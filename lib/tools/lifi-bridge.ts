import { tool } from 'ai'
import { z } from 'zod'
import {
  executeLifiBridgeTransaction,
  // executeLifiBridgeTransactionWithAutoFuel,
  generateLifiBridgeQuote
} from '../lifi/actions'
import { executeLifiBridgeTransactionWithAutoFuel } from '../lifi/auto-fuel-helper'
import { getUserEvmWalletAddress } from '../privy/client'
import { chainsById } from '../token-matcher/fuzzy-chain-matcher'
import { ToolContext } from '../types/context'
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
    console.log('fromChain', fromChain)
    console.log('toChain', toChain)
    console.log('fromToken', fromToken)
    console.log('toToken', toToken)
    console.log('amountIn', amountIn)
    console.log('slippage', slippage)
    console.log('recipient', recipient)
    const userEvmAddress = await getUserEvmWalletAddress()
    if (!userEvmAddress) {
      return {
        instruction: 'notify user',
        details: "User's embedded wallet not found"
      }
    }
    return await generateLifiBridgeQuote(
      fromChain,
      toChain,
      fromToken,
      toToken,
      userEvmAddress,
      amountIn,
      slippage,
      recipient,
      false
    )
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

    // if (autoFuel) {
    //   return await executeLifiBridgeTransactionWithAutoFuel(
    //     userEvmAddress,
    //     fromChainId,
    //     fromToken,
    //     fromTokenDecimals,
    //     fromTokenAddress,
    //     toChainId,
    //     toToken,
    //     amountIn,
    //     slippage,
    //     recipient,
    //     isFromNativeToken,
    //     fromChainName,
    //     toChainName
    //   )
    // }
    
    return await executeLifiBridgeTransaction(
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
  }
})

export { bridgeExecuteTool, bridgeQuoteTool }



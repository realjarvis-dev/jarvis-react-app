import { tool } from 'ai'
import { z } from 'zod'
import {
  generateLifiBridgeQuote
} from '../lifi/actions'
import { executeLifiBridgeTransactionSolana } from '../lifi/actions-solana'
import { getUserEvmWalletAddress, getUserSolWalletAddress } from '../privy/client'
import { ToolContext } from '../types/context'
import { getUserId } from '../privy/client'
import { balanceChangePub } from '../pubsub/balance-change-pub'
import { ChainType } from '../network/types'
import { LIFI_SOLANA_CHAIN_ID } from '../token-matcher/token-utils'
import { getConfigByChainId } from '../network/config'


const bridgeQuoteSolanaTool = tool({
  description:
    `Get a quote for a cross-chain transaction from user's solana wallet to user's evm wallet.
    User can call it swap or bridge, you should use this tool when detecting cross chain intent
    Only supports bridging from USDC, USDT, or SOL.
    You must ask user whether they prefer fastest or cheapest route. It automatically renders UI on success.`,
  parameters: z.object({
    fromChain: z
      .string()
      .default("Solana")
      .describe(
        "The chain to bridge from. Default to Solana"
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
        'The amount of input tokens to bridge, in human readable format.'
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
    let {toChain, fromToken, toToken, amountIn, slippage, recipient, preference } = params
    if (Number(amountIn) < 0.002) {
      throw Error("Sorry, the amount is too small to bridge. Can you try again with a larger amount?")
    }
    const fromChain = "solana"
    let fromUserAddress;
    let toUserAddress = recipient;
    if (!toUserAddress) {
      toUserAddress = await getUserEvmWalletAddress()
    }

    fromUserAddress = await getUserSolWalletAddress()


    if (!fromUserAddress || !toUserAddress) {
      return {
        instruction: 'notify user',
        details: "User's embedded wallet not found"
      }
    }

    const result = await generateLifiBridgeQuote(
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromUserAddress,
      amountIn,
      slippage,
      toUserAddress,
      false,
      preference
    )
    
    
    return result
  }
})

const bridgeExecuteSolanaTool = tool({
  description:
    "Execute a cross-chain bridge transfer from user's wallet. This tool should be used after the user has confirmed the quote.",
  parameters: z.object({
    fromChainId: z.number().default(LIFI_SOLANA_CHAIN_ID).describe('The chain id to bridge from'),
    fromChainName: z.string().default("Solana").describe('The name of the chain to bridge from'),
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
    let fromUserAddress;
    let toUserAddress = recipient;
    if (!toUserAddress) {
      toUserAddress = await getUserEvmWalletAddress()
    }
    fromUserAddress = await getUserSolWalletAddress()

    if (!fromUserAddress || !toUserAddress) {
      return {
        instruction: 'notify user',
        details: "User's embedded wallet not found"
      }
    }
    const isDemo = context?.networkContext?.isDemo
 
    
    const result =  await executeLifiBridgeTransactionSolana(
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

    balanceChangePub(userId, [context.networkContext?.selectedNetwork as ChainType, toChainType as ChainType], isDemo || false)
    return result
  }
})

export { bridgeExecuteSolanaTool, bridgeQuoteSolanaTool }



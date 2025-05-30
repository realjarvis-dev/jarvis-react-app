import { tool } from 'ai'
import { z } from 'zod'
import {
  executeLifiBridgeTransaction,
  generateLifiBridgeQuote
} from '../lifi/actions'
import { getUserEvmWalletAddress } from '../privy/client'

const bridgeQuoteTool = tool({
  description:
    "Get a quote for a cross-chain bridge transfer from user's wallet. can also be single chain swap. It automatically renders UI on success.",
  parameters: z.object({
    fromChain: z
      .string()
      .describe(
        "The chain to bridge from, can be chain name or chain symbol. don't have to be exact match"
      ),
    toChain: z
      .string()
      .describe(
        "The chain to bridge to, can be chain name or chain symbol. don't have to be exact match"
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
      )
  }),
  execute: async ({
    fromChain,
    toChain,
    fromToken,
    toToken,
    amountIn,
    slippage,
    recipient
  }) => {
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
      recipient
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
      )
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
    toChainName
  }) => {
    return await executeLifiBridgeTransaction(
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
      toChainName
    )
  }
})

export { bridgeExecuteTool, bridgeQuoteTool }

// const hash = await executeSwapTransaction({
//     value: '0x38d7ea4c68000',
//     to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
//     data: '0xaf7060fdf18dcd2bccfec0d1ca1c7fc3ec242c4a9692022f3f0e68cc412cdd412008978800000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000020dc1b6732e7a20acba461bd37beead4ff5d93c800000000000000000000000000000000000000000000000000000000002956eb000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000086c6966692d617069000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a3078303030303030303030303030303030303030303030303030303030303030303030303030303030300000000000000000000000000000000000000000000000000000000000000000000085cd07ea01423b1e937929b44e4ad8c40bbb5e7100000000000000000000000085cd07ea01423b1e937929b44e4ad8c40bbb5e710000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001a4dd9c5f96000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000000038d7ea4c68000000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000298c1900000000000000000000000000000000000000000000000000000000002956ea0000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae0000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000700301ffff0201397ff1542f962076d0bfe58ea045ffa2d347aca0c02aaa39b223fe8d0a0e5c4f27ead9083c756cc204c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200397ff1542f962076d0bfe58ea045ffa2d347aca00085cd07ea01423b1e937929b44e4ad8c40bbb5e71000bb80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
//     chainId: 1,
//     gasPrice: '0x7a3a9137',
//     gasLimit: '0x65900',
//     from: '0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8'
//   }, 1, {
//     estimateGas: false,
//     gasLimit: "0x65900"
//   })

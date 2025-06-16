import { tool } from 'ai'
import { formatUnits, parseUnits } from 'viem'
import { z } from 'zod'
import { getConfigByChainId } from '../network/config'
import { getPendleMarkets } from '../pendle/api'
import { addLiquiditySingleEnableAggregator } from '../pendle/liquidity-single'
import { getERC20Details } from '../pendle/transactions'
import { getUserEvmWalletAddress, getUserId } from '../privy/client'
import { findTokenInUserWalletByIdentifier } from '../token-matcher/token-utils'
import { ToolContext } from '../types/context'
import { balanceChangePub } from '../pubsub/balance-change-pub'

export const pendleZapInQuoteTool = tool({
  description: `Get a quote for adding liquidity (zap in) to a Pendle market. This tool should be used before executing the transaction. 
    You MUST confirm with user whether they want the zero price impact mode or not before quoting.
    For example, if user say "zap in <number> <token> to <market>", you should ask user whether they want the zero price impact mode or not.
    Recommend disable zpi for not advanced users. zpi has to be false if tokenInType is pt.
    `,
  parameters: z.object({
    marketName: z
      .string()
      .describe('The name of the market to add liquidity to. '),
    marketAddress: z
      .string()
      .optional()
      .describe(
        'The address of the market to add liquidity to. If not provided, the market will be fetched from the list of market using the market name.'
      ),
    tokenInName: z.string().describe('The name of the input token'),
    tokenInAddress: z
      .string()
      .optional()
      .describe(
        "The address of the input token. If not provided, the token will be fetched from user's wallet using the token name."
      ),
    tokenInType: z
      .enum(['sy', 'yt', 'pt', 'other'])
      .describe('The type of the input token'),
    amountIn: z
      .string()
      .describe('The amount of the input token. in human readable format'),
    slippage: z
      .number()
      .default(0.01)
      .describe(
        'The slippage tolerance for the transaction. 0.01 for 1% slippage. Default to 0.01'
      ),
    zeroPriceImpact: z
      .boolean()
      .describe(
        'Whether to use zero price impact for the transaction. Please confirm with user if they did not specify use askQuestion tool.'
      )
  }),
  execute: async (params, context: ToolContext) => {
    let {
      marketName,
      marketAddress,
      tokenInName,
      tokenInAddress,
      tokenInType,
      amountIn,
      slippage,
      zeroPriceImpact
    } = params
    try {
      const networkContext = context.networkContext
      const chainId = networkContext!.selectedChainId
      const isDemo = networkContext!.isDemo
      const userAddress = await getUserEvmWalletAddress()
      if (isDemo) {
        slippage = 0.1
      }
      if (!userAddress) {
        return {
          status: 'fail',
          error_message: 'User address not available',
          hash: null
        }
      }
      const markets = await getPendleMarkets()
      let market = null
      if (!marketAddress) {
        market = markets.find(
          market => market.name.toLowerCase() === marketName.toLowerCase()
        )
      } else {
        market = markets.find(
          market =>
            market.address.toLowerCase() ===
            (marketAddress as string).toLowerCase()
        )
      }
      if (!market) {
        return {
          status: 'fail',
          error_message: 'Market not found',
          hash: null
        }
      }

      marketAddress = market.address
      const ytAddress = market.yt
      const ytDetails = await getERC20Details(ytAddress, chainId)
      const ytDecimals = Number(ytDetails.decimals)

      let tokenInDecimals = 18
      if (!tokenInAddress) {
        const tokenResult = await findTokenInUserWalletByIdentifier(
          tokenInName,
          userAddress,
          chainId,
          isDemo
        )
        if (tokenResult.status === 'fail') {
          return {
            status: 'fail',
            error_message: tokenResult.error_message,
            hash: null
          }
        }
        tokenInAddress = tokenResult.token!.address
        tokenInDecimals = Number(tokenResult.token!.decimals)
      }

      if (tokenInType === 'yt') {
        return {
          status: 'fail',
          error_message: 'PT is not supported for zap in',
          hash: null
        }
      }
      if (tokenInType === 'pt' && zeroPriceImpact) {
        return {
          status: 'fail',
          error_message: 'Zero price impact is not supported for PT',
          hash: null
        }
      }
      const amountInWei = parseUnits(amountIn, tokenInDecimals).toString()
      let result = await addLiquiditySingleEnableAggregator(
        chainId,
        marketAddress,
        userAddress,
        tokenInAddress,
        amountInWei,
        slippage,
        zeroPriceImpact,
        isDemo,
        false
      )

      if (result.status === 'fail') {
        return {
          status: 'fail',
          error_message: result.error
        }
      }
      result.quoteData!.amountLpOut = formatUnits(
        BigInt(result.quoteData!.amountLpOut),
        18
      )
      // console.log('ytDecimals', ytDecimals)
      result.quoteData!.amountYtOut = formatUnits(
        BigInt(result.quoteData!.amountYtOut),
        ytDecimals
      )
      return {
        status: 'success',
        quote: result.quoteData,
        marketAddress: marketAddress,
        tokenInAddress: tokenInAddress,
        tokenInType: tokenInType,
        tokenInDecimals: tokenInDecimals,
        amountIn: amountIn,
        slippage: slippage,
        zeroPriceImpact: zeroPriceImpact,
        ytDecimals: ytDecimals,
        ytName: ytDetails.name,
        completeTime: new Date().toISOString()
      }
    } catch (error) {
      console.error(error)
      return {
        status: 'fail',
        error_message: 'Error getting quote'
      }
    }
  }
})

export const pendleZapInExecuteTool = tool({
  description:
    'Execute a zap in transaction to a Pendle market. This tool should be used after the user has confirmed the quote.',
  parameters: z.object({
    marketName: z
      .string()
      .describe('The name of the market to add liquidity to. '),
    marketAddress: z
      .string()
      .describe('The address of the market to add liquidity to. '),
    tokenInName: z.string().describe('The name of the input token'),
    tokenInAddress: z.string().describe('The address of the input token'),
    tokenInDecimals: z.number().describe('The decimals of the input token'),
    ytDecimals: z
      .number()
      .describe(
        'The decimals of the YT token. This is used to convert the amount of YT token to human readable format.'
      ),
    amountIn: z.string().describe('The amount of the input token'),
    slippage: z
      .number()
      .default(0.01)
      .describe(
        'The slippage tolerance for the transaction. 0.01 for 1% slippage. Default to 0.01'
      ),
    zeroPriceImpact: z
      .boolean()
      .describe('Whether to use zero price impact for the transaction.')
  }),
  execute: async (params, context: ToolContext) => {
    let {
      marketName,
      marketAddress,
      tokenInName,
      tokenInAddress,
      tokenInDecimals,
      ytDecimals,
      amountIn,
      slippage,
      zeroPriceImpact
    } = params
    const networkContext = context.networkContext
    const chainId = networkContext!.selectedChainId
    const isDemo = networkContext!.isDemo
    const userAddress = await getUserEvmWalletAddress()
    if (!userAddress) {
      return {
        status: 'fail',
        error_message: 'User address not available',
        hash: null
      }
    }
    if (isDemo) {
      slippage = 0.1
    }
    const amountInWei = parseUnits(amountIn, tokenInDecimals).toString()
    const result = await addLiquiditySingleEnableAggregator(
      chainId,
      marketAddress,
      userAddress,
      tokenInAddress,
      amountInWei,
      slippage,
      zeroPriceImpact,
      isDemo,
      true
    )
    if (result.status === 'fail') {
      return {
        status: 'fail',
        error_message: result.error
      }
    }
    result.quoteData!.amountLpOut = formatUnits(
      BigInt(result.quoteData!.amountLpOut),
      18
    )

    result.quoteData!.amountYtOut = formatUnits(
      BigInt(result.quoteData!.amountYtOut),
      ytDecimals
    )
    const explorerLink = getConfigByChainId(chainId, isDemo).scanLink
    const explorerLinkWithHash = `https://${explorerLink}/tx/${result.hash}`
    const userId = await getUserId()
    balanceChangePub(userId, [networkContext!.config.id], isDemo)

    return {
      status: 'success',
      hash: result.hash,
      addLiquidityData: result.quoteData,
      completeTime: new Date().toISOString(),
      explorerLink: explorerLink ? explorerLinkWithHash : undefined
    }
  }
})

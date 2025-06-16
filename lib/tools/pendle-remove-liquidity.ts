import { tool } from 'ai'
import { parseUnits } from 'viem'
import { z } from 'zod'
import { getTokenBalances } from '../alchemy/get-token-balance'
import { getPendleMarkets } from '../pendle/api'
import { removeLiquiditySingleEnableAggregator } from '../pendle/liquidity-single'
import { getUserEvmWalletAddress } from '../privy/client'
import {
  findTokenInFullListByIdentifier,
  findTokenInUserWalletByIdentifier
} from '../token-matcher/token-utils'
import { ToolContext } from '../types/context'

export const pendleZapOutQuoteTool = tool({
  description: `Get a quote for removing liquidity (zap out) from a Pendle market. This tool should be used before executing the transaction.
  `,
  parameters: z.object({
    marketName: z
      .string()
      .describe('The name of the market to remove liquidity from.'),
    marketAddress: z
      .string()
      .optional()
      .describe(
        'The address of the market to remove liquidity from. If not provided, the market will be fetched from the list of market using the market name.'
      ),
    tokenOutName: z
      .string()
      .describe('The name or the symbol of the output token'),
    tokenOutAddress: z
      .string()
      .optional()
      .describe(
        'The address of the output token. If not provided, the token will be fetched from the list of token using the token name.'
      ),
    amountLpIn: z
      .string()
      .describe(
        'The amount of LP token to remove liquidity from, in human readable format.'
      ),
    slippage: z.number().describe('The slippage tolerance for the transaction.')
  }),
  execute: async (params, context: ToolContext) => {
    let {
      marketName,
      marketAddress,
      tokenOutName,
      tokenOutAddress,
      amountLpIn,
      slippage
    } = params
    const networkContext = context.networkContext!
    const isDemo = networkContext.isDemo
    const chainId = networkContext.selectedChainId
    const userAddress = await getUserEvmWalletAddress()

    // if market address is not provided, fetch the market from the list of market using the market name
    if (!marketAddress) {
      const markets = await getPendleMarkets()
      const market = markets.find(
        market => market.name.toLowerCase() === marketName.toLowerCase()
      )
      if (!market) {
        return {
          status: 'fail',
          error: `Market not found`
        }
      }
      marketAddress = market.address
    }
    // check if marketAddress is in user's wallet, since it has the same address as the LP token
    const userBalances = await getTokenBalances(userAddress!, chainId, isDemo)
    const lpToken = userBalances.find(
      balance => balance.address.toLowerCase() === marketAddress.toLowerCase()
    )
    if (!lpToken) {
      return {
        status: 'fail',
        error: `LP token not found in user's wallet`
      }
    }
    if (Number(amountLpIn) > Number(lpToken.balance)) {
      return {
        status: 'fail',
        error: `Amount of LP token to remove liquidity from is greater than the amount in user's wallet`
      }
    }
    const amountLpInWei = parseUnits(amountLpIn, 18)

    // if token out address is not provided, fetch the token from the list of token using the token name
    let tokenOut = tokenOutAddress
    if (!tokenOutAddress) {
      const tokenResult = await findTokenInUserWalletByIdentifier(
        tokenOutName,
        userAddress!,
        chainId,
        isDemo,
        userBalances.map(balance => ({
          chainId: chainId,
          address: balance.address,
          symbol: balance.symbol,
          name: balance.name,
          decimals: balance.decimals
        }))
      )
      if (
        tokenResult.status === 'fail' &&
        tokenResult.error_message === 'Token not found in wallet'
      ) {
        // try to find the token in the full list
        const tokenResult = await findTokenInFullListByIdentifier(
          tokenOutName,
          chainId
        )
        if (tokenResult.status === 'fail') {
          return {
            status: 'fail',
            error: tokenResult.error_message
          }
        }
        tokenOut = tokenResult.token!.address!
      } else if (tokenResult.status === 'fail') {
        return {
          status: 'fail',
          error: tokenResult.error_message
        }
      } else {
        tokenOut = tokenResult.token!.address!
      }
    }

    // get the quote for removing liquidity
    const quote = await removeLiquiditySingleEnableAggregator(
      chainId,
      marketAddress,
      userAddress!,
      tokenOut as string,
      amountLpInWei.toString(),
      slippage,
      isDemo,
      false
    )

    return {
      status: 'success',
      data: quote.removeLiquidityData
    }
  }
})

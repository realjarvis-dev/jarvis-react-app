import { tool } from 'ai'
import { formatUnits, parseUnits } from 'viem'
import { z } from 'zod'
import { getConfigByChainId } from '../network/config'
import { getPendleMarkets } from '../pendle/api'
import { addLiquiditySingleEnableAggregator } from '../pendle/liquidity-single'
import { getERC20Details } from '../privy/utils'
import { getUserEvmWalletAddress, getUserId } from '../privy/client'
import { findTokenInUserWalletByIdentifier } from '../token-matcher/token-utils'
import { ToolContext } from '../types/context'
import { balanceChangePub } from '../pubsub/balance-change-pub'

export const pendleZapInQuoteTool = tool({
  description: `Get a quote for adding liquidity (zap in) to a Pendle market. This tool should be used before executing the transaction. 
    You MUST confirm with user whether they want the zero price impact mode or not before quoting.
    For example, if user say "zap in <number> <token> to <market>", you should ask user whether they want the zero price impact mode or not if they are not using pt token.
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
        'Whether to use zero price impact for the transaction. Default to false if user uses pt token to zap in, otherwise please confirm with user if they did not specify use askQuestion tool.'
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
        slippage = 0.3
      }
      if (!userAddress) {
        return {
          status: 'fail',
          error_message: 'User address not available',
          hash: null
        }
      }
      let market = null
      if (!marketAddress) {
        // First try static markets from JSON config
        const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher')
        const staticMarkets = pendleTokenMatcher.getAllMarketsForChain(chainId)
        
        console.log(`[DEBUG] Looking for market: "${marketName}"`)
        console.log(`[DEBUG] Available static markets:`, staticMarkets.map(m => ({ name: m.name, address: m.address })))
        
        // Try exact match first
        market = staticMarkets.find(
          m => m.name.toLowerCase() === marketName.toLowerCase()
        )
        
        // If not found, try fuzzy matching
        if (!market) {
          const searchTerm = marketName.toLowerCase().replace(/\s+(lp|pool|market).*$/i, '')
          console.log(`[DEBUG] Fuzzy search term: "${searchTerm}"`)
          
          market = staticMarkets.find(m => 
            m.name.toLowerCase().includes(searchTerm) || 
            searchTerm.includes(m.name.toLowerCase())
          )
          
          if (market) {
            console.log(`[DEBUG] Found fuzzy match: ${market.name}`)
            // Convert to expected format
            market = {
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
            }
          }
        } else {
          console.log(`[DEBUG] Found exact match: ${market.name}`)
          // Convert to expected format
          market = {
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
          }
        }
        
        // Fallback to API markets if static lookup fails
        if (!market) {
          console.log(`[DEBUG] Fallback to API markets`)
          const markets = await getPendleMarkets('active', chainId)
          console.log(`[DEBUG] API markets:`, markets.map(m => ({ name: m.name, address: m.address })))
          
          market = markets.find(
            market => market.name.toLowerCase() === marketName.toLowerCase()
          )
        }
      } else {
        const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher')
        const staticMarket = pendleTokenMatcher.getAllMarketsForChain(chainId).find(
          m => m.address.toLowerCase() === (marketAddress as string).toLowerCase()
        )
        
        if (staticMarket) {
          market = {
            name: staticMarket.name,
            address: staticMarket.address,
            expiry: staticMarket.expiry,
            pt: staticMarket.pt,
            yt: staticMarket.yt,
            sy: staticMarket.sy,
            underlyingAsset: staticMarket.underlyingAsset,
            liquidity: 0, // Will be fetched dynamically if needed
            impliedApy: 0, // Will be fetched dynamically if needed
            active: true
          }
        } else {
          const markets = await getPendleMarkets('active', chainId)
          market = markets.find(
            market =>
              market.address.toLowerCase() ===
              (marketAddress as string).toLowerCase()
          )
        }
      }
      if (!market) {
        console.log(`[ERROR] Market not found for: "${marketName}" on chain ${chainId}`)
        return {
          status: 'fail',
          error_message: `Market not found: "${marketName}". Please check the market name and try again.`,
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
          error_message: 'YT is not supported for zap in',
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
      
      try {
        result.quoteData!.amountLpOut = formatUnits(
          BigInt(result.quoteData!.amountLpOut),
          18
        )
    
        result.quoteData!.amountYtOut = formatUnits(
          BigInt(result.quoteData!.amountYtOut),
          ytDecimals
        )
      } catch (error) {
        console.log("can't convert quote data passing it as is", error)
      }
  
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
      console.error('[ERROR] Pendle zap-in quote failed:', error)
      console.log('[DEBUG] Tool parameters:', params)
      return {
        status: 'fail',
        error_message: `Error getting quote: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      slippage = 0.3
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
      console.error('[ERROR] Pendle zap-in execution failed:', result.error)
      console.log('[DEBUG] Execute parameters:', params)
      return {
        status: 'fail',
        error_message: result.error
      }
    }

    try {
      result.quoteData!.amountLpOut = formatUnits(
        BigInt(result.quoteData!.amountLpOut),
        18
      )
  
      result.quoteData!.amountYtOut = formatUnits(
        BigInt(result.quoteData!.amountYtOut),
        ytDecimals
      )
    } catch (error) {
      console.log("can't convert quote data passing it as is", error)
    }


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

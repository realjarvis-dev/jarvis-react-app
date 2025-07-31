import { tool } from 'ai'
import { formatUnits, parseUnits } from 'viem'
import { z } from 'zod'
import { getTokenBalances } from '../alchemy/get-token-balance'
import { getPendleMarkets } from '../pendle/api'
import { removeLiquiditySingleEnableAggregator } from '../pendle/liquidity-single'
import { getUserEvmWalletAddress, getUserId } from '../privy/client'
import {
  findTokenInFullListByIdentifier,
  findTokenInUserWalletByIdentifier
} from '../token-matcher/token-utils'
import { ToolContext } from '../types/context'
import { getConfigByChainId } from '../network/config'
import { getERC20Details } from '../privy/utils'
import { balanceChangePub } from '../pubsub/balance-change-pub'

export const pendleZapOutQuoteTool = tool({
  description: `Get a quote for removing liquidity (zap out) from a Pendle market (pool). This tool MUST be called before pendleZapOutExecuteTool.
    CRITICAL FLOW: ALWAYS call this quote tool first, then pass ALL returned values (including quotedAmountOut and completeTime) to the execute tool.
    IMPORTANT: 
    - Only use amounts that are available in user's wallet balance. The tool will validate balance and fail if amount exceeds available balance.
    - The execute tool requires the exact quotedAmountOut and completeTime from this quote
  `,
  parameters: z.object({
    marketName: z
      .string()
      .describe('The name of the market (pool) to remove liquidity from.'),
    marketAddress: z
      .string()
      .optional()
      .describe(
        'The address of the market to remove liquidity from. If not provided, the market will be fetched from the list of market using the market name.'
      ),
    tokenOutType: z.enum(["sy", "pt", "underlying", "other"]).describe("The type of the output token. Usually it's other token, except user ask for the sy, pt, or underlying asset of the market"),
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
      slippage,
      tokenOutType
    } = params
    const networkContext = context.networkContext!
    const isDemo = networkContext.isDemo
    const chainId = networkContext.selectedChainId
    const userAddress = await getUserEvmWalletAddress()

    // if market address is not provided, fetch the market from the list of market using the market name
    // also if tokenOutType is sy and tokenOutAddress is not provided, fetch the sy from the market
    if (!marketAddress || (tokenOutType === "sy" && !tokenOutAddress)) {
      const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher')
      const allMarkets = pendleTokenMatcher.getAllMarketsForChain(chainId)
      
      console.log(`[DEBUG] Looking for remove liquidity market: "${marketName}"`)
      console.log(`[DEBUG] Available static markets:`, allMarkets.map(m => ({ name: m.name, address: m.address })))
      
      // Try exact match first
      let market = allMarkets.find(
        m => m.name.toLowerCase() === marketName.toLowerCase() || m.address.toLowerCase() === marketAddress?.toLowerCase()
      )
      
      // If not found, try fuzzy matching
      if (!market) {
        // Extract token name from various patterns like:
        // "Pendle Market (sENA)" -> "sENA"
        // "sENA LP Pool" -> "sENA"
        // "sENA Market" -> "sENA"
        let searchTerm = marketName.toLowerCase()
        
        // Extract content from parentheses first
        const parenthesesMatch = searchTerm.match(/\(([^)]+)\)/)
        if (parenthesesMatch) {
          searchTerm = parenthesesMatch[1]
        } else {
          // Remove common suffixes if no parentheses
          searchTerm = searchTerm
            .replace(/^(pendle\s+)?(market\s+)?/i, '') // Remove "Pendle Market" prefix
            .replace(/\s+(lp|pool|market).*$/i, '') // Remove "LP Pool" etc suffix
        }
        
        console.log(`[DEBUG] Fuzzy search term: "${searchTerm}"`)
        
        market = allMarkets.find(m => 
          m.name.toLowerCase().includes(searchTerm) || 
          searchTerm.includes(m.name.toLowerCase())
        )
        
        if (market) {
          console.log(`[DEBUG] Found fuzzy match: ${market.name}`)
        }
      } else {
        console.log(`[DEBUG] Found exact match: ${market.name}`)
      }
      
      marketName = market?.name || marketName
      if (!market) {
        console.log(`[ERROR] Market not found for remove liquidity: "${marketName}" on chain ${chainId}`)
        return {
          status: 'fail',
          error_message: `Market not found: "${marketName}". Please check the market name and try again.`
        }
      }
      if (tokenOutType === "sy" && !tokenOutAddress) {
        tokenOutAddress = market.sy
      } else if (tokenOutType === "pt" && !tokenOutAddress) {
        tokenOutAddress = market.pt
      } else if (tokenOutType === "underlying" && !tokenOutAddress) {
        tokenOutAddress = market.underlyingAsset
      }
      marketAddress = market.address
    }
    // Validate user has sufficient LP token balance
    const userBalances = await getTokenBalances(userAddress!, chainId, isDemo)
    const lpToken = userBalances.find(
      balance => balance.address.toLowerCase() === marketAddress.toLowerCase()
    )
    
    if (!lpToken) {
      console.log(`[ERROR] LP token not found in user wallet: ${marketAddress}`)
      return {
        status: 'fail',
        error_message: `LP token for ${marketName} not found in your wallet`
      }
    }
    
    const amountLpInWei = parseUnits(amountLpIn, 18)
    const availableBalanceWei = parseUnits(lpToken.balance, 18)
    
    if (amountLpInWei > availableBalanceWei) {
      const availableBalance = (Number(availableBalanceWei) / Math.pow(10, 18)).toFixed(6)
      console.log(`[ERROR] Insufficient LP balance. Requested: ${amountLpIn}, Available: ${availableBalance}`)
      return {
        status: 'fail',
        error_message: `Insufficient LP balance. You have ${availableBalance} LP tokens, but requested ${amountLpIn}`
      }
    }
    
    console.log(`[DEBUG] LP balance check passed. Requested: ${amountLpIn}, Available: ${(Number(availableBalanceWei) / Math.pow(10, 18)).toFixed(6)}`)
    let tokenOutDecimals;
    let tokenOutSymbol;
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
            error_message: tokenResult.error_message
          }
        }
        tokenOut = tokenResult.token!.address!
        tokenOutDecimals = Number(tokenResult.token!.decimals)
        tokenOutSymbol = tokenResult.token!.symbol!
        tokenOutName = tokenResult.token!.name!
      } else if (tokenResult.status === 'fail') {
        return {
          status: 'fail',
          error_message: tokenResult.error_message
        }
      } else {
        tokenOut = tokenResult.token!.address!
        tokenOutDecimals = Number(tokenResult.token!.decimals)
        tokenOutSymbol = tokenResult.token!.symbol!
        tokenOutName = tokenResult.token!.name!
      }
    }
    if (!tokenOutDecimals) {
      const tokenDetails = await getERC20Details(tokenOut as string, chainId)
      tokenOutDecimals = Number(tokenDetails.decimals)
      tokenOutSymbol = tokenDetails.symbol!
      tokenOutName = tokenDetails.name!
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
    if (quote.status === 'fail') {
      return {
        status: 'fail',
        error_message: quote.error
      }
    }
    try {
      quote.quoteData!.amountOut = formatUnits(BigInt(quote.quoteData!.amountOut), tokenOutDecimals)
    } catch (error) {
      console.log("can't convert quote data passing it as is", error)
    }
    return {
      status: 'success',
      quote: quote.quoteData,
      marketAddress: marketAddress,
      marketName: marketName,
      tokenOutAddress: tokenOut,
      tokenOutDecimals: tokenOutDecimals,
      tokenOutSymbol: tokenOutSymbol,
      tokenOutName: tokenOutName,
      amountIn: amountLpIn,
      slippage: slippage,
      quotedAmountOut: quote.quoteData!.amountOut,
      completeTime: new Date().toISOString()
    }
  }
})

export const pendleZapOutExecuteTool = tool({
  description: `Execute a removing liquidity (zap out) from a Pendle market. CRITICAL: This tool can ONLY be used immediately after calling pendleZapOutQuoteTool with the EXACT SAME parameters. You MUST verify that a quote was generated for the exact same marketName, tokenOutName, amountIn, slippage values. Do NOT execute if the previous tool call was not pendleZapOutQuoteTool or if any parameters differ.`,
  parameters: z.object({
    marketName: z.string().describe('The name of the market to remove liquidity from.'),
    marketAddress: z.string().describe('The address of the market to remove liquidity from.'),
    tokenOutName: z.string().describe('The name or the symbol of the output token'),
    tokenOutDecimals: z.number().describe('The decimals of the output token'),
    tokenOutAddress: z.string().describe('The address of the output token'),
    amountLpIn: z.string().describe('The amount of LP token to remove liquidity from, in human readable format.'),
    slippage: z.number().describe('The slippage tolerance for the transaction.'),
    quotedAmountOut: z
      .string()
      .describe('The token amount out from the quote. This MUST match the exact value returned by pendleZapOutQuoteTool.'),
    quoteTimestamp: z
      .string()
      .describe('The timestamp from the quote (completeTime field). Used to validate quote freshness.')
  }),
  execute: async (params, context: ToolContext) => {
    let {
      marketName,
      marketAddress,
      tokenOutName,
      tokenOutAddress,
      amountLpIn,
      slippage,
      tokenOutDecimals,
      quotedAmountOut,
      quoteTimestamp
    } = params
    
    // Validate quote freshness and consistency
    const quoteTime = new Date(quoteTimestamp)
    const currentTime = new Date()
    const timeDiffMinutes = (currentTime.getTime() - quoteTime.getTime()) / (1000 * 60)
    
    if (timeDiffMinutes > 5) {
      console.log(`[ERROR] Remove liquidity quote is stale. Quote time: ${quoteTimestamp}, Current: ${currentTime.toISOString()}, Diff: ${timeDiffMinutes.toFixed(2)} minutes`)
      return {
        status: 'fail',
        error_message: 'Quote is too old (>5 minutes). Please get a fresh quote before executing.',
        hash: null
      }
    }
    
    console.log(`[DEBUG] Remove liquidity quote validation passed. Age: ${timeDiffMinutes.toFixed(2)} minutes, Expected token out: ${quotedAmountOut}`)

    const networkContext = context.networkContext!
    const isDemo = networkContext.isDemo
    const chainId = networkContext.selectedChainId
    const userAddress = await getUserEvmWalletAddress()
    const amountLpInWei = parseUnits(amountLpIn, 18)
    if (isDemo) {
      slippage = 0.1
    }
    
    // Validate user has sufficient LP token balance before execution
    const userBalances = await getTokenBalances(userAddress!, chainId, isDemo)
    const lpToken = userBalances.find(
      balance => balance.address.toLowerCase() === marketAddress.toLowerCase()
    )
    
    if (!lpToken) {
      console.log(`[ERROR] LP token not found in user wallet during execution: ${marketAddress}`)
      return {
        status: 'fail',
        error_message: `LP token for ${marketName} not found in your wallet`,
        hash: null
      }
    }
    
    const availableBalanceWei = parseUnits(lpToken.balance, 18)
    
    if (amountLpInWei > availableBalanceWei) {
      const availableBalance = (Number(availableBalanceWei) / Math.pow(10, 18)).toFixed(6)
      console.log(`[ERROR] Insufficient LP balance during execution. Requested: ${amountLpIn}, Available: ${availableBalance}`)
      return {
        status: 'fail',
        error_message: `Insufficient LP balance. You have ${availableBalance} LP tokens, but requested ${amountLpIn}`,
        hash: null
      }
    }
    
    console.log(`[DEBUG] Execute LP balance check passed. Requested: ${amountLpIn}, Available: ${(Number(availableBalanceWei) / Math.pow(10, 18)).toFixed(6)}`)
    
    const quote = await removeLiquiditySingleEnableAggregator(
      chainId,
      marketAddress,
      userAddress!,
      tokenOutAddress as string,
      amountLpInWei.toString(),
      slippage,
      isDemo,
      true
    )
    if (quote.status === 'fail') {
      return {
        status: 'fail',
        error: quote.error
      }
    }
    try {
      quote.quoteData!.amountOut = formatUnits(BigInt(quote.quoteData!.amountOut), tokenOutDecimals)
    } catch (error) {
      console.log("can't convert quote data passing it as is", error)
    }

    const explorerLink = getConfigByChainId(chainId, isDemo).scanLink 
    const explorerLinkWithHash = `https://${explorerLink}/tx/${quote.hash}`
    const userId = await getUserId()
    balanceChangePub(userId, [networkContext!.config.id], isDemo)


    return {
      status: 'success',
      hash: quote.hash,
      removeLiquidityData: quote.quoteData,
      actualAmountOut: quote.quoteData!.amountOut,
      expectedAmountOut: quotedAmountOut,
      amountInUsed: amountLpIn,
      completeTime: new Date().toISOString(),
      explorerLink: explorerLink ? explorerLinkWithHash : undefined
    }
  }
})

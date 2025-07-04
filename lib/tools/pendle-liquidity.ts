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
  description: `Get a quote for adding liquidity (zap in) to a Pendle market. This tool MUST be called before pendleZapInExecuteTool.
    CRITICAL FLOW: ALWAYS call this quote tool first, then pass ALL returned values (including quotedAmountOut and completeTime) to the execute tool.
    IMPORTANT: 
    - Only use amounts that are available in user's wallet balance. The tool will validate balance and fail if amount exceeds available balance.
    - Only ask about zero price impact mode if tokenInType is NOT 'pt'. 
    - If tokenInType is 'pt': automatically set zeroPriceImpact to false, do NOT ask user
    - If tokenInType is NOT 'pt': ask user whether they want zero price impact mode
    - The execute tool requires the exact quotedAmountOut and completeTime from this quote
    Zero price impact mode is not supported for PT tokens.
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
        'Whether to use zero price impact for the transaction. MUST be false if tokenInType is "pt". Only ask user about this option if tokenInType is NOT "pt".'
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
      // Enforce zero price impact rules
      if (tokenInType === 'pt' && zeroPriceImpact) {
        console.log('[DEBUG] Automatically disabling zero price impact for PT token')
        zeroPriceImpact = false
      }
      
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

      // Check if PT token is expired (market inactive)
      if (tokenInType === 'pt') {
        const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher')
        const ptToken = pendleTokenMatcher.findTokenByAddress(tokenInAddress!, chainId)
        
        if (ptToken && ptToken.expiry) {
          const expiryDate = new Date(ptToken.expiry)
          const currentDate = new Date()
          
          if (expiryDate < currentDate) {
            console.log(`[ERROR] PT token expired. Expiry: ${ptToken.expiry}, Current: ${currentDate.toISOString()}`)
            return {
              status: 'fail',
              error_message: `This PT token has expired (${expiryDate.toLocaleDateString()}). Expired PT tokens cannot be used for zapping as their markets are inactive. Consider redeeming the token instead.`,
              hash: null
            }
          }
        }
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
      
      // Validate user has sufficient balance
      if (!tokenInAddress) {
        return {
          status: 'fail',
          error_message: 'Token address not found',
          hash: null
        }
      }
      
      const { getTokenBalances } = await import('../alchemy/get-token-balance')
      const userTokenBalances = await getTokenBalances(userAddress, chainId, isDemo)
      const userTokenBalance = userTokenBalances.find(
        token => token.address.toLowerCase() === tokenInAddress!.toLowerCase()
      )
      
      if (!userTokenBalance) {
        console.log(`[ERROR] Token not found in user wallet: ${tokenInAddress!}`)
        return {
          status: 'fail',
          error_message: `Token ${tokenInName} not found in your wallet`,
          hash: null
        }
      }
      
      const amountInWei = parseUnits(amountIn, tokenInDecimals)
      // const availableBalanceWei = BigInt(userTokenBalance.balance)
      const availableBalanceWei = parseUnits(userTokenBalance.balance, tokenInDecimals)
      
      if (amountInWei > availableBalanceWei) {
        const availableBalance = (Number(availableBalanceWei) / Math.pow(10, tokenInDecimals)).toFixed(6)
        console.log(`[ERROR] Insufficient balance. Requested: ${amountIn}, Available: ${availableBalance}`)
        return {
          status: 'fail',
          error_message: `Insufficient balance. You have ${availableBalance} ${tokenInName}, but requested ${amountIn}`,
          hash: null
        }
      }
      
      console.log(`[DEBUG] Balance check passed. Requested: ${amountIn}, Available: ${(Number(availableBalanceWei) / Math.pow(10, tokenInDecimals)).toFixed(6)}`)
      
      let result = await addLiquiditySingleEnableAggregator(
        chainId,
        marketAddress,
        userAddress,
        tokenInAddress!,
        amountInWei.toString(),
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
        quotedAmountOut: result.quoteData!.amountLpOut,
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
    'Execute a zap in transaction to a Pendle market. CRITICAL: This tool can ONLY be used immediately after calling pendleZapInQuoteTool with the EXACT SAME parameters. You MUST verify that a quote was generated for the exact same marketName, tokenInName, tokenInType, amountIn, slippage, and zeroPriceImpact values. Do NOT execute if the previous tool call was not pendleZapInQuoteTool or if any parameters differ.',
  parameters: z.object({
    marketName: z
      .string()
      .describe('The name of the market to add liquidity to. '),
    marketAddress: z
      .string()
      .describe('The address of the market to add liquidity to. '),
    tokenInName: z.string().describe('The name of the input token'),
    tokenInAddress: z.string().describe('The address of the input token'),
    tokenInType: z
      .enum(['sy', 'yt', 'pt', 'other'])
      .describe('The type of the input token'),
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
      .describe('Whether to use zero price impact for the transaction.'),
    quotedAmountOut: z
      .string()
      .describe('The LP amount out from the quote. This MUST match the exact value returned by pendleZapInQuoteTool.'),
    quoteTimestamp: z
      .string()
      .describe('The timestamp from the quote (completeTime field). Used to validate quote freshness.')
  }),
  execute: async (params, context: ToolContext) => {
    let {
      marketName,
      marketAddress,
      tokenInName,
      tokenInAddress,
      tokenInType,
      tokenInDecimals,
      ytDecimals,
      amountIn,
      slippage,
      zeroPriceImpact,
      quotedAmountOut,
      quoteTimestamp
    } = params
    // Validate quote freshness and consistency
    const quoteTime = new Date(quoteTimestamp)
    const currentTime = new Date()
    const timeDiffMinutes = (currentTime.getTime() - quoteTime.getTime()) / (1000 * 60)
    
    if (timeDiffMinutes > 5) {
      console.log(`[ERROR] Quote is stale. Quote time: ${quoteTimestamp}, Current: ${currentTime.toISOString()}, Diff: ${timeDiffMinutes.toFixed(2)} minutes`)
      return {
        status: 'fail',
        error_message: 'Quote is too old (>5 minutes). Please get a fresh quote before executing.',
        hash: null
      }
    }
    
    console.log(`[DEBUG] Quote validation passed. Age: ${timeDiffMinutes.toFixed(2)} minutes, Expected LP out: ${quotedAmountOut}`)

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
    
    // Check if PT token is expired (market inactive) before execution
    if (tokenInType === 'pt') {
      const { pendleTokenMatcher } = await import('../token-matcher/pendle-token-matcher')
      const ptToken = pendleTokenMatcher.findTokenByAddress(tokenInAddress, chainId)
      
      if (ptToken && ptToken.expiry) {
        const expiryDate = new Date(ptToken.expiry)
        const currentDate = new Date()
        
        if (expiryDate < currentDate) {
          console.log(`[ERROR] PT token expired during execution. Expiry: ${ptToken.expiry}, Current: ${currentDate.toISOString()}`)
          return {
            status: 'fail',
            error_message: `This PT token has expired (${expiryDate.toLocaleDateString()}). Expired PT tokens cannot be used for zapping as their markets are inactive. Consider redeeming the token instead.`,
            hash: null
          }
        }
      }
    }
    
    // Validate user has sufficient balance before execution
    const { getTokenBalances } = await import('../alchemy/get-token-balance')
    const userTokenBalances = await getTokenBalances(userAddress, chainId, isDemo)
    const userTokenBalance = userTokenBalances.find(
      token => token.address.toLowerCase() === tokenInAddress.toLowerCase()
    )
    
    if (!userTokenBalance) {
      console.log(`[ERROR] Token not found in user wallet during execution: ${tokenInAddress}`)
      return {
        status: 'fail',
        error_message: `Token ${tokenInName} not found in your wallet`,
        hash: null
      }
    }
    
    const amountInWei = parseUnits(amountIn, tokenInDecimals)
    // const availableBalanceWei = BigInt(userTokenBalance.balance)
    const availableBalanceWei = parseUnits(userTokenBalance.balance, tokenInDecimals)

    
    if (amountInWei > availableBalanceWei) {
      const availableBalance = (Number(availableBalanceWei) / Math.pow(10, tokenInDecimals)).toFixed(6)
      console.log(`[ERROR] Insufficient balance during execution. Requested: ${amountIn}, Available: ${availableBalance}`)
      return {
        status: 'fail',
        error_message: `Insufficient balance. You have ${availableBalance} ${tokenInName}, but requested ${amountIn}`,
        hash: null
      }
    }
    
    console.log(`[DEBUG] Execute balance check passed. Requested: ${amountIn}, Available: ${(Number(availableBalanceWei) / Math.pow(10, tokenInDecimals)).toFixed(6)}`)
    
    const result = await addLiquiditySingleEnableAggregator(
      chainId,
      marketAddress,
      userAddress,
      tokenInAddress,
      amountInWei.toString(),
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
      actualAmountOut: result.quoteData!.amountLpOut,
      expectedAmountOut: quotedAmountOut,
      amountInUsed: amountIn,
      completeTime: new Date().toISOString(),
      explorerLink: explorerLink ? explorerLinkWithHash : undefined
    }
  }
})

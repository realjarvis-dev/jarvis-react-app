import { tool } from 'ai'
import z from 'zod'
import { ToolContext } from '../types/context'
import { executeJupiterOrder, getJupiterOrder } from '../jupiter/order'
import { searchVerifiedTokensByName, searchXStocksByName } from '../jupiter/search'
import { formatUnits, parseUnits } from 'viem'
import { computeNetworkFeeFromTxString } from '../jupiter/utils'
import { clusterApiUrl, Connection, SendTransactionError } from '@solana/web3.js'
import { getUserSolWalletAddress } from '../privy/client'
import * as _ from "lodash";
import { broadcastSolanaTransaction, signSolanaTransactionString } from '../privy/solana-utils'

const commonTokenMap = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}
const commonTokenDecimals = {
  SOL: 9,
  USDC: 6,
}

// Helper function to resolve token address and decimals
async function resolveToken(token: string) {
  if (token === "SOL" || token === "USDC") {
    return {
      address: commonTokenMap[token],
      decimals: commonTokenDecimals[token]
    }
  } else {
    const xStock = await searchVerifiedTokensByName(token)
    if (xStock.length === 0) {
      return {
        error: `Token ${token} not found`
      }
    }
    if (xStock.length > 1) {
      return {
        error: `Multiple tokens found for ${token}`,
        tokenOptions: xStock.map((token) => ({
          name: token.name,
          symbol: token.symbol,
          address: token.id
        }))
      }
    }
    return {
      address: xStock[0].id,
      decimals: xStock[0].decimals
    }
  }
}

export const jupiterQuote = tool({
    description: `Get the quote for a given trade on jupiter dex. Use this tool when user wants a swap. You should always give a quote if user wants to trade without ask.`,
    parameters: z.object({
        // userSolanaAddress: z.string().describe('The user\'s solana address'),
        tokenInDisplayName: z.string().describe('The name or symbol of the token to sell, for displaying purpose'),
        tokenOutDisplayName: z.string().describe('The name or symbol of the token to buy, for displaying purpose'),
        tokenIn: z.string().describe('The token to sell. You should prefer address if available. Name or symbol is also acceptable.'),
        tokenOut: z.string().describe('The token to buy. You should prefer address if available. Name or symbol is also acceptable.'),
        amountIn: z.number().describe('The amount of tokenIn in human readable format'),

    }),
    execute: async (params, context: ToolContext) => {
        const { tokenIn, tokenOut, amountIn } = params
        const userSolanaAddress = await getUserSolWalletAddress()
        
        // Resolve tokenIn
        const tokenInResult = await resolveToken(tokenIn)
        if ('error' in tokenInResult) {
            return {
                status: tokenInResult.tokenOptions ? "Warning" : "Failed",
                instruction: tokenInResult.tokenOptions ? "User can choose one of the following tokens" : undefined,
                tokenOptions: tokenInResult.tokenOptions,
                error: tokenInResult.error
            }
        }
        const { address: tokenInAddress, decimals: tokenInDecimals } = tokenInResult

        // Resolve tokenOut
        const tokenOutResult = await resolveToken(tokenOut)
        if ('error' in tokenOutResult) {
            return {
                status: tokenOutResult.tokenOptions ? "Warning" : "Failed",
                instruction: tokenOutResult.tokenOptions ? "User can choose one of the following tokens" : undefined,
                tokenOptions: tokenOutResult.tokenOptions,
                error: tokenOutResult.error
            }
        }
        const { address: tokenOutAddress, decimals: tokenOutDecimals } = tokenOutResult

        const amountInLamports = parseUnits(amountIn.toString(), tokenInDecimals)
        let quoteResult;
        try {
            quoteResult = await getJupiterOrder({
                inputMint: tokenInAddress,
                outputMint: tokenOutAddress,
                amount: amountInLamports.toString(),
                taker: userSolanaAddress,
                swapMode: "ExactIn"
            })
        } catch (error) {
            // retry
            try {
                quoteResult = await getJupiterOrder({
                    inputMint: tokenInAddress,
                    outputMint: tokenOutAddress,
                    amount: amountInLamports.toString(),
                    swapMode: "ExactIn"
                })
            } catch (error) {
                return {
                    status: "Failed",
                    error: "Failed to get quote"
                }
            }
            
        }

        const connection = new Connection(context.networkContext?.rpcUrl || clusterApiUrl('mainnet-beta'))
        let networkFee;
        if (quoteResult.transaction && quoteResult.transaction !== "") {
            networkFee = formatUnits(BigInt(await computeNetworkFeeFromTxString(quoteResult.transaction, connection) || 0), 9)

        }

        const allMarkets = quoteResult.routePlan.map((route) => route.swapInfo.label)
        const allMarketAddresses = quoteResult.routePlan.map((route) => route.swapInfo.ammKey)
        const numMarkets = _.uniq(allMarkets).length

        const amountOut = formatUnits(BigInt(quoteResult.outAmount), tokenOutDecimals)
        const enoughBalance = quoteResult.transaction && quoteResult.transaction !== ""
        return {
            status: "Success",
            instruction: enoughBalance ? "User has enough balance, you can ask if they want to proceed with the trade" : `User does not have enough balance of ${tokenIn} to trade ${amountIn} ${tokenIn}`,
            swapDetails: {
                amountOut: amountOut,
                networkFee: networkFee || 0,
                numMarkets: numMarkets,
                routeMarketNames: allMarkets,
                routeMarketAddresses: allMarketAddresses,
                tokenOutDecimals: tokenOutDecimals,
                tokenOutAddress: tokenOutAddress,
                amountIn: amountIn,
                tokenInAddress: tokenInAddress,
                tokenInDecimals: tokenInDecimals,
                router: quoteResult.router,
                priceImpactPct: quoteResult.priceImpact,
                amountInUsd: quoteResult.inUsdValue,
                amountOutUsd: quoteResult.outUsdValue,
                feeBps: quoteResult.feeBps,
                completeTime: new Date().toISOString()
                
            }
            
        }
        
        

    }
})

export const jupiterExecute = tool({
    description: `Execute a trade. This tool should be used after the user has confirmed the quote.`,
    parameters: z.object({
        tokenInDisplayName: z.string().describe('The name or symbol of the token to sell, for displaying purpose'),
        tokenOutDisplayName: z.string().describe('The name or symbol of the token to buy, for displaying purpose'),
        tokenInAddress: z.string().describe('The address of the token to sell'),
        tokenOutAddress: z.string().describe('The address of the token to buy'),
        amountIn: z.number().describe('The amount of tokenIn in human readable format'),
        tokenInDecimals: z.number().describe('The decimals of the token to sell'),
        tokenOutDecimals: z.number().describe('The decimals of the token to buy'),
    }),
    execute: async (params, context: ToolContext) => {
        try {
        const { tokenInAddress, tokenOutAddress, amountIn, tokenInDecimals, tokenOutDecimals, tokenInDisplayName } = params
        const amountInLamports = parseUnits(amountIn.toString(), tokenInDecimals)
        const userSolanaAddress = await getUserSolWalletAddress()
        let quoteResult;
        
        try {
            quoteResult = await getJupiterOrder({
                inputMint: tokenInAddress,
                outputMint: tokenOutAddress,
                amount: amountInLamports.toString(),
                taker: userSolanaAddress,
                swapMode: "ExactIn"
            })
        } catch (error) {
            try {
                quoteResult = await getJupiterOrder({
                    inputMint: tokenInAddress,
                    outputMint: tokenOutAddress,
                    amount: amountInLamports.toString(),
                    swapMode: "ExactIn"
                })
                return {
                    status: "Failed",
                    error: `Insufficient ${tokenInDisplayName}`
                }
            } catch (error) {
            return {
                status: "Failed",
                error: "Failed to execute. No route found."
            }
        }
    }

    if (!quoteResult.transaction || quoteResult.transaction === "") {
        return {
            status: "Failed",
            error: "Failed to execute. No route found."
        }
    }

    const connection = new Connection(context.networkContext?.rpcUrl || clusterApiUrl('mainnet-beta'))
    const signedTransaction = await signSolanaTransactionString(quoteResult.transaction, connection)
    
    try {
        const txid = await broadcastSolanaTransaction(signedTransaction, connection)
    if (txid) {
        const amountOut = formatUnits(BigInt(quoteResult.outAmount), tokenOutDecimals)
        const explorerUrl = `https://solscan.io/tx/${txid}`
        return {
            status: "Success",
            swapDetails: {
                signature: txid,
                explorerUrl: explorerUrl,
                amountIn: amountIn,
                amountOut: amountOut,
                amountInUsd: quoteResult.inUsdValue,
                amountOutUsd: quoteResult.outUsdValue,
                completeTime: new Date().toISOString()
            }
        }
    } else {
        return {
            status: "Failed",
            error: "Failed to execute. "
        }
    }
    } catch (error) {
        if (error instanceof SendTransactionError) {
            console.error(error)
            return {
                status: "Failed",
                error: "Failed to execute. " + (error as Error).message
            }
        }
        return {
            status: "Failed",
            error: "Failed to execute. " + (error as Error).message
        }
    }
    }
    catch (error) {
        console.error(error)
        return {
            status: "Failed",
            error: "Failed to execute. " + (error as Error).message
        }
    }
}
})
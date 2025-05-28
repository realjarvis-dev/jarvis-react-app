import { tool } from 'ai'
import { z } from 'zod'
import { lifiService, MissingChainError, MissingTokenError } from '../token-matcher/cross-chain-swap'
import { TokenWithScore } from '../token-matcher/fuzzy-token-matcher'
import { ChainWithScore } from '../token-matcher/fuzzy-chain-matcher'
import { getUserEvmWalletAddress } from '../privy/client'
import { ethers, TransactionRequest } from 'ethers'
import { LifiQuoteResponse } from '../types/lifi'
import { chainsById } from '../token-matcher/fuzzy-chain-matcher'
import { getLifiQuote } from '../lifi/api'
import { erc20Approval, executeSwapTransaction } from '../pendle/transactions'

const getClarifyInputAndOutputDetail = (fromChain: ChainWithScore, toChain: ChainWithScore, fromTokenList: TokenWithScore[], toTokenList: TokenWithScore[]) => {
    const possibleInputTokens = fromTokenList.map(token => token.symbol).join(', ')
    const possibleOutputTokens = toTokenList.map(token => token.symbol).join(', ')
    return `Multiple tokens found, please choose the token you want to bridge from and to. Possible input tokens on ${fromChain.name} chain: ${possibleInputTokens}, possible output tokens on ${toChain.name} chain: ${possibleOutputTokens}`
}

const getClarifyInputDetail = (fromChain: ChainWithScore, fromTokenList: TokenWithScore[]) => {
    const possibleInputTokens = fromTokenList.map(token => token.symbol).join(', ')
    return `Multiple input tokens found, please choose the token you want to bridge from. Possible input tokens on ${fromChain.name} chain: ${possibleInputTokens}`
}

const getClarifyOutputDetail = (toChain: ChainWithScore, toTokenList: TokenWithScore[]) => {
    const possibleOutputTokens = toTokenList.map(token => token.symbol).join(', ')
    return `Multiple output tokens found, please choose the token you want to bridge to. Possible output tokens on ${toChain.name} chain: ${possibleOutputTokens}`
}

const bridgeQuoteTool = tool({
  description: "Get a quote for a cross-chain bridge transfer from user's wallet. can also be single chain swap. It automatically renders UI on success.",
  parameters: z.object({
    fromChain: z.string().describe("The chain to bridge from, can be chain name or chain symbol. don't have to be exact match"),
    toChain: z.string().describe("The chain to bridge to, can be chain name or chain symbol. don't have to be exact match"),
    fromToken: z.string().describe("The token to bridge from, can be token symbol or token name. don't have to be exact match"),
    toToken: z.string().describe("The token to bridge to, can be token symbol or token name. don't have to be exact match"),
    amountIn: z.string().describe("The amount of input tokens to bridge, in human readable format"),
    slippage: z.string().default('0.005').describe("The slippage tolerance for the transaction, 0.005 represents 0.5% slippage. Default to 0.005"),
    recipient: z.string().optional().describe("The address to send the bridged tokens to. Default to user's wallet address"),
  }),
  execute: async ({ fromChain, toChain, fromToken, toToken, amountIn, slippage, recipient }) => {
    // first use the fuzzy matcher to find the best match
    const userEvmAddress = await getUserEvmWalletAddress()
    if (!userEvmAddress) {
        return {
            instruction: 'notify user',
            details: "User's embedded wallet not found"
        }
    }
    if (!recipient) {
        recipient = userEvmAddress
    }
    try {
        const { fromChain: fromChainMatch, toChain: toChainMatch, fromTokenList, toTokenList } = await lifiService.fuzzyIntentDetect(fromChain, toChain, fromToken, toToken)
        let fromTokenSingle: TokenWithScore
        let toTokenSingle: TokenWithScore
        let requireClarifyInput = false
        let requireClarifyOutput = false
        if (fromTokenList.length === 1) {
            // we can directly use the token
            fromTokenSingle = fromTokenList[0]
        } else {
            requireClarifyInput = true
            fromTokenSingle = fromTokenList[0]
        }

        if (toTokenList.length === 1) {
            toTokenSingle = toTokenList[0]
        } else {
            requireClarifyOutput = true
            toTokenSingle = toTokenList[0]
        }

        if (requireClarifyInput && requireClarifyOutput) {
            return {
                instruction: 'clarify the input and output with user',
                details: getClarifyInputAndOutputDetail(fromChainMatch, toChainMatch, fromTokenList, toTokenList)
            }
        } else if (requireClarifyInput) {
            return {
                instruction: 'clarify the input token with user',
                details: getClarifyInputDetail(fromChainMatch, fromTokenList)
            }
        } else if (requireClarifyOutput) {
            return {
                instruction: 'clarify the output token with user',
                details: getClarifyOutputDetail(toChainMatch, toTokenList)
            }
        }
        const inputDecimals = fromTokenSingle.decimals
        const outputDecimals = toTokenSingle.decimals
        const inputAmount = ethers.parseUnits(amountIn, inputDecimals).toString()

        // get a quote from lifi service
        const quote: LifiQuoteResponse = await getLifiQuote(fromChainMatch.id, toChainMatch.id, fromTokenSingle.symbol, toTokenSingle.symbol, inputAmount, userEvmAddress, recipient, slippage)
        const otherFeeArray = quote.estimate?.feeCosts?.map((fee) => ({
            name: fee.name,
            symbol: fee.token.symbol,
            chainName: chainsById[fee.token.chainId].name,
            amount: ethers.formatUnits(fee.amount, fee.token.decimals),
            amountUSD: fee.amountUSD
        }))
        const gasFeeArray = quote.estimate?.gasCosts?.map((gas) => ({
            type: gas.type,
            symbol: gas.token.symbol,
            chainName: chainsById[gas.token.chainId].name,
            amount: ethers.formatUnits(gas.amount, gas.token.decimals),
            amountUSD: gas.amountUSD
        }))
        const inAmountParsed = ethers.formatUnits(quote.estimate?.fromAmount, inputDecimals)
        const outAmountParsed = ethers.formatUnits(quote.estimate?.toAmount, outputDecimals)

        const readableQuote = {
            fromChain: fromChainMatch.name,
            fromChainId: fromChainMatch.id,
            fromToken: fromTokenSingle.symbol,
            fromAmountToken: inAmountParsed,
            fromAmountUSD: quote.estimate?.fromAmountUSD,
            isFromNativeToken: fromTokenSingle.address === '0x0000000000000000000000000000000000000000',
            toChain: toChainMatch.name,
            toChainId: toChainMatch.id,
            toToken: toTokenSingle.symbol,
            toAmountToken: outAmountParsed,
            toAmountUSD: quote.estimate?.toAmountUSD,
            gasCosts: gasFeeArray,
            gasCostsUSD: quote.estimate?.gasCosts?.reduce((acc, curr) => acc + Number(curr.amountUSD), 0),
            otherFeeDetails: otherFeeArray,
            otherFeeUSD: quote.estimate?.feeCosts?.reduce((acc, curr) => acc + Number(curr.amountUSD), 0),
            complete_time: new Date().toISOString()
        }
        return {
            instruction: "Don't repeat the quote to user, simply ask user if they want to proceed with the transaction.",
            details: readableQuote
        }

    } catch (error) {
        if (error instanceof MissingChainError || error instanceof MissingTokenError) {
            return {
                instruction: 'clarify the input and output with user',
                details: error.message
            }
        }
        return {
            instruction: 'unexpected error occurred',
            details: error instanceof Error ? error.message : 'Unknown error'
        }
    }
    
  }
})

const bridgeExecuteTool = tool({
  description: "Execute a cross-chain bridge transfer from user's wallet. can also be single chain swap. It automatically renders UI on success.",
  parameters: z.object({
    fromChainId: z.number().describe("The chain id to bridge from"),
    fromToken: z.string().describe("The token to bridge from, has to be exact match"),
    fromTokenDecimals: z.number().describe("The decimals of the input token"),
    isFromNativeToken: z.boolean().describe("Whether the input token is the native token of the from chain"),
    toChainId: z.number().describe("The chain id to bridge to"),
    toToken: z.string().describe("The token to bridge to, has to be exact match"),
    amountIn: z.string().describe("The amount of input tokens to bridge, in human readable format"),
    slippage: z.string().default('0.005').describe("The slippage tolerance for the transaction, 0.005 represents 0.5% slippage. Default to 0.005"),
    recipient: z.string().optional().describe("The address to send the bridged tokens to. Default to user's wallet address"),

  }),
  execute: async ({ fromChainId, fromToken, fromTokenDecimals, toChainId, toToken, amountIn, slippage, recipient, isFromNativeToken }) => {
    const userEvmAddress = await getUserEvmWalletAddress()
    if (!userEvmAddress) {
        return {
            instruction: 'notify user',
            details: "User's embedded wallet not found"
        }
    }
    if (!recipient) {
        recipient = userEvmAddress
    }
    const inputAmount = ethers.parseUnits(amountIn, fromTokenDecimals).toString()
    const quote: LifiQuoteResponse = await getLifiQuote(fromChainId, toChainId, fromToken, toToken, inputAmount, userEvmAddress, recipient, slippage)
    if (!quote.transactionRequest.to) {
        return {
            instruction: 'notify user',
            details: "Li.fi's protocol address not found."
        }
    }
    const protocolAddress = quote.transactionRequest.to as string

    if (!isFromNativeToken) {
        const {status, message} = await erc20Approval(fromToken, protocolAddress, inputAmount, userEvmAddress, fromChainId)
        if (status === 'fail') {
            return {
                instruction: 'notify user',
                details: message
            }
        }
    }
    const txData = quote.transactionRequest as TransactionRequest
    const hash = await executeSwapTransaction(txData, fromChainId)


    return {
        instruction: 'execute the transaction',
        hash: hash
    }
  }
})

export { bridgeQuoteTool, bridgeExecuteTool }
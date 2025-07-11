import { TransactionRequest } from 'ethers'
import { formatUnits, parseUnits, toHex } from 'viem'
import { getGasPriceByChainId } from '../blocknative/get-gas-price'
import { erc20Approval, executeTransaction } from '../privy/utils'
import { getUserEvmWalletAddress } from '../privy/client'
import {
  crossChainMatcher,
  MissingChainError,
  MissingTokenError
} from '../token-matcher/cross-chain-matcher'
import { chainsById } from '../token-matcher/fuzzy-chain-matcher'
import {
  TokenMatcher,
  type Token
} from '../token-matcher/fuzzy-token-matcher'
import { LifiQuoteResponse } from '../types/lifi'
import { getLifiQuote } from './api'
import {
  autoFuelFailDetails,
  autoFuelFailTitle,
  getClarifyInputAndOutputDetail,
  getClarifyInputDetail,
  getClarifyOutputDetail,
  noRouteDetails,
  noRouteTitle
} from './utils'
import { getConfigByChainId } from '@/lib/network/config'

const solanaCommonTokenMap = {
  SOL: '11111111111111111111111111111111',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}
const solanaCommonTokenDecimals = {
  SOL: 9,
  USDC: 6,
}
const NATIVE_TOKEN_STRING = '0x0000000000000000000000000000000000000000'

export const generateLifiBridgeQuote = async (
  fromChain: string,
  toChain: string,
  fromToken: string,
  toToken: string,
  fromAddress: string,
  amountIn: string,
  slippage: string,
  recipient?: string,
  autoFuelDestChain?: boolean,
  preference: "FASTEST" | "CHEAPEST" = "FASTEST"
) => {
  autoFuelDestChain = false

  if (!recipient) {
    recipient = fromAddress
  }
  try {
    const {
      fromChain: fromChainMatch,
      toChain: toChainMatch,
      fromTokenList,
      toTokenList
    } = await crossChainMatcher.fuzzyIntentDetect(
      fromChain,
      toChain,
      fromToken,
      toToken
    )
    let fromTokenSingle: Token
    let toTokenSingle: Token
    let requireClarifyInput = false
    let requireClarifyOutput = false
    if (fromTokenList.length === 1) {
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
        details: getClarifyInputAndOutputDetail(
          fromChainMatch,
          toChainMatch,
          fromTokenList,
          toTokenList
        )
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
    const inputAmount = parseUnits(amountIn, inputDecimals).toString()
    console.log(fromChainMatch.id, toChainMatch.id)
    console.log(fromTokenSingle.symbol, toTokenSingle.symbol)
    console.log(inputAmount)
    console.log(fromAddress)
    console.log(recipient)
    console.log(slippage)
    console.log(preference)
    let quote: LifiQuoteResponse
    try {
      quote = await getLifiQuote(
        fromChainMatch.id,
        toChainMatch.id,
        fromTokenSingle.symbol,
        toTokenSingle.symbol,
        inputAmount,
        fromAddress,
        recipient,
        slippage,
        preference
      )
    } catch (error) {
      return {
        instruction: 'notify user',
        title: noRouteTitle,
        details: noRouteDetails,
        more_details: error instanceof Error ? error.message : 'Unknown error'
      }
    }
    const otherFeeArray = quote.estimate?.feeCosts?.map(fee => ({
      name: fee.name,
      symbol: fee.token.symbol,
      chainName: chainsById[fee.token.chainId].name,
      amount: formatUnits(BigInt(fee.amount), fee.token.decimals),
      amountUSD: fee.amountUSD
    }))
    const gasFeeArray = quote.estimate?.gasCosts?.map(gas => ({
      type: gas.type,
      symbol: gas.token.symbol,
      chainName: chainsById[gas.token.chainId].name,
      amount: formatUnits(BigInt(gas.amount), gas.token.decimals),
      amountUSD: gas.amountUSD,
      gasLimit: gas.limit
    }))
    const inAmountParsed = formatUnits(
      BigInt(quote.estimate?.fromAmount),
      inputDecimals
    )
    const outAmountParsed = formatUnits(
      BigInt(quote.estimate?.toAmount),
      outputDecimals
    )
    // console.log(JSON.stringify(quote, null, 2))

    const readableQuote = {
      fromChain: fromChainMatch.name,
      fromChainId: fromChainMatch.id,
      fromToken: fromTokenSingle.symbol,
      fromAmountToken: inAmountParsed,
      fromAmountUSD: quote.estimate?.fromAmountUSD,
      fromTokenAddress: fromTokenSingle.address.toLowerCase(),
      isFromNativeToken: fromTokenSingle.address === NATIVE_TOKEN_STRING,
      toChain: toChainMatch.name,
      toChainId: toChainMatch.id,
      toToken: toTokenSingle.symbol,
      toAmountToken: outAmountParsed,
      toAmountUSD: quote.estimate?.toAmountUSD,
      gasCosts: gasFeeArray,
      gasCostsUSD: quote.estimate?.gasCosts?.reduce(
        (acc, curr) => acc + Number(curr.amountUSD),
        0
      ),
      otherFeeDetails: otherFeeArray,
      otherFeeUSD: quote.estimate?.feeCosts?.reduce(
        (acc, curr) => acc + Number(curr.amountUSD),
        0
      ),
      auto_fuel_decision: false,
      complete_time: new Date().toISOString()
    }
    return {
      instruction: `Don't repeat the quote to user, simply ask user if they want to proceed with the transaction. If user wants to proceed, use lifi_bridge_execute tool to execute the transaction.`,
      details: readableQuote
    }
  } catch (error) {
    if (
      error instanceof MissingChainError ||
      error instanceof MissingTokenError
    ) {
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



export const executeLifiBridgeTransaction = async (
  fromAddress: string,
  fromChainId: number,
  fromToken: string,
  fromTokenDecimals: number,
  fromTokenAddress: string,
  toChainId: number,
  toToken: string,
  amountIn: string,
  slippage: string,
  recipient: string | undefined,
  isFromNativeToken: boolean,
  fromChainName: string,
  toChainName: string,
  isDemo: boolean = false,
  preference: "FASTEST" | "CHEAPEST" = "FASTEST"
) => {
  let result: { hash: string }
  result = { hash: '' }
  // const userEvmAddress = await getUserEvmWalletAddress()
  // if (!userEvmAddress) {
  //   return {
  //     instruction: 'notify user',
  //     details: "User's embedded wallet not found"
  //   }
  // }
  if (!recipient) {
    recipient = fromAddress
  }
  console.log("Amount in", amountIn)
  const inputAmount = parseUnits(amountIn, fromTokenDecimals).toString()
  console.log("Input amount", inputAmount)
  const quote: LifiQuoteResponse = await getLifiQuote(
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    inputAmount,
    fromAddress,
    recipient,
    slippage,
    preference
  )
  if (!quote.transactionRequest.to) {
    return {
      instruction: 'notify user',
      details: "Li.fi's protocol address not found."
    }
  }
  const protocolAddress = quote.transactionRequest.to as string

  try {
    if (!isFromNativeToken) {
      const { status, message } = await erc20Approval(
        fromTokenAddress,
        protocolAddress,
        inputAmount,
        fromAddress,
        fromChainId,
        isDemo
      )
      if (status === 'fail') {
        return {
          instruction: 'notify user',
          details: message
        }
      }
    }
    const txData = quote.transactionRequest as TransactionRequest
    const gasLimit = BigInt(
      quote.estimate?.gasCosts?.reduce(
        (acc, curr) => acc + Number(curr.limit),
        0
      ) ?? 0
    )
    // console.log('quote in execute', JSON.stringify(quote, null, 2))

    // const result = await executeSwapTransaction(txData, fromChainId, {
    //   estimateGas: gasLimit > 0 ? false : true,
    //   gasLimit: gasLimit ? toHex(gasLimit) : undefined
    // })
    // assume txData.gasPrice is a hex string like "0x …"
    // const oldGas = BigInt(txData.gasPrice as `0x${string}`)

    // // multiply by 1.2 ⇒ multiply by 12, divide by 10
    // const newGas = (oldGas * BigInt(12)) / BigInt(10)

    // // convert back to a hex string (Ethereum‐style)
    // const gasPriceHex = "0x" + newGas.toString(16) as `0x${string}`
    
    if (!isDemo) {
    result = await executeTransaction(txData, fromChainId, {
        estimateGas: true,
        eip1559GasPriceFunction: getGasPriceByChainId
      }, isDemo)
    } else {
      result = await executeTransaction(txData, fromChainId, {
        estimateGas: false,
        gasLimit: gasLimit ? toHex(gasLimit) : undefined,
        eip1559GasPriceFunction: getGasPriceByChainId
      }, isDemo)
    }
    const explorerLink = getConfigByChainId(fromChainId, isDemo).scanLink
    const explorerLinkWithHash = `https://${explorerLink}/tx/${result.hash}`
    

    return {
      success: true,
      transaction_hash: result.hash,
      swap_details: {
        from_token_symbol: fromToken,
        from_token_address: fromTokenAddress,
        to_token_address: toToken,
        amount_in_human: amountIn,
        from_chain_name: fromChainName,
        to_chain_name: toChainName,
        explorer_link: explorerLink ? explorerLinkWithHash : undefined,
        complete_time: new Date().toISOString()
      }
    }
  } catch (error: any) {
    console.error("Error during transaction execution", error)
    const errorMessage =
      error?.message || 'Unknown error during transaction execution'
    return {
      success: false,
      error: errorMessage,
      hash: result?.hash || '',
      swap_details: {
        from_token_symbol: fromToken,
        from_token_address: fromTokenAddress,
        to_token_address: toToken,
        amount_in_human: amountIn,
        from_chain_name: fromChainName,
        to_chain_name: toChainName,
        complete_time: new Date().toISOString()
      }
    }
  }
}

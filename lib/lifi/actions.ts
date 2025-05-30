import { TransactionRequest } from 'ethers'
import { formatUnits, parseUnits, toHex } from 'viem'
import { getGasPriceByChainId } from '../alchemy/get-gas-price'
import { getNativeBalanceByChainId } from '../alchemy/get-token-balance'
import { erc20Approval, executeSwapTransaction } from '../pendle/transactions'
import { getUserEvmWalletAddress } from '../privy/client'
import {
  lifiService,
  MissingChainError,
  MissingTokenError
} from '../token-matcher/cross-chain-swap'
import { chainsById } from '../token-matcher/fuzzy-chain-matcher'
import { TokenWithScore } from '../token-matcher/fuzzy-token-matcher'
import { LifiQuoteResponse } from '../types/lifi'
import { getLifiQuote } from './api'
import {
  getClarifyInputAndOutputDetail,
  getClarifyInputDetail,
  getClarifyOutputDetail
} from './utils'

const PREDEFINED_GAS_LIMIT = 1000000

export const generateLifiBridgeQuote = async (
  fromChain: string,
  toChain: string,
  fromToken: string,
  toToken: string,
  amountIn: string,
  slippage: string,
  recipient?: string,
  autoFuelDestChain?: boolean
) => {
  const userEvmAddress = await getUserEvmWalletAddress()
  if (autoFuelDestChain === undefined) {
    autoFuelDestChain = true
  }
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
    const {
      fromChain: fromChainMatch,
      toChain: toChainMatch,
      fromTokenList,
      toTokenList
    } = await lifiService.fuzzyIntentDetect(
      fromChain,
      toChain,
      fromToken,
      toToken
    )
    let fromTokenSingle: TokenWithScore
    let toTokenSingle: TokenWithScore
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

    if (fromChainMatch.id !== toChainMatch.id) {
      // check user's balance on dest chain
      const balanceDestChain = await getNativeBalanceByChainId(recipient, toChainMatch.id)
      
    }


    const inputDecimals = fromTokenSingle.decimals
    const outputDecimals = toTokenSingle.decimals
    const inputAmount = parseUnits(amountIn, inputDecimals).toString()

    let quote: LifiQuoteResponse
    try {
      quote = await getLifiQuote(
        fromChainMatch.id,
        toChainMatch.id,
        fromTokenSingle.symbol,
        toTokenSingle.symbol,
        inputAmount,
        userEvmAddress,
        recipient,
        slippage
      )
    } catch (error) {
      return {
        instruction: 'notify user',
        title: 'No routes available for the selected combination',
        details:
          'Reasons for that could be: low liquidity, amount selected is too low, gas costs are too high or there are no routes for the selected combination.',
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
      amountUSD: gas.amountUSD
    }))
    const inAmountParsed = formatUnits(
      BigInt(quote.estimate?.fromAmount),
      inputDecimals
    )
    const outAmountParsed = formatUnits(
      BigInt(quote.estimate?.toAmount),
      outputDecimals
    )

    const readableQuote = {
      fromChain: fromChainMatch.name,
      fromChainId: fromChainMatch.id,
      fromToken: fromTokenSingle.symbol,
      fromAmountToken: inAmountParsed,
      fromAmountUSD: quote.estimate?.fromAmountUSD,
      fromTokenAddress: fromTokenSingle.address.toLowerCase(),
      isFromNativeToken:
        fromTokenSingle.address ===
        '0x0000000000000000000000000000000000000000',
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
      complete_time: new Date().toISOString()
    }
    return {
      instruction:
        "Don't repeat the quote to user, simply ask user if they want to proceed with the transaction. If user wants to proceed, use lifi_bridge_execute tool to execute the transaction.",
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

// when user don't have native token on the dest chain, trigger this
const _generateMultiStepQuote = async (
  fromChainId: number,
  fromTokenSymbol: string,
  fromTokenDecimals: number,
  fromAddress: string,
  toChainId: number,
  toChainNativeTokenSymbol: string,
  toToken: string,
  amountIn: string,
  slippage: string,
  recipient: string
) => {
  // first we get a quote from lifi, use the dest chain's native token
  const inputAmount = parseUnits(amountIn, fromTokenDecimals).toString()
  const nativeTokenQuote: LifiQuoteResponse = await getLifiQuote(
    fromChainId,
    toChainId,
    fromTokenSymbol,
    toChainNativeTokenSymbol,
    inputAmount,
    fromAddress,
    recipient,
    slippage
  )
  const toAmountNativeTokenInWei = BigInt(nativeTokenQuote.estimate?.toAmount ?? '0')
  const gasPrice = await getGasPriceByChainId(toChainId)

  // save some fee for future operations
  const feeToSave = gasPrice * BigInt(PREDEFINED_GAS_LIMIT)
  const amountToSwapInWei = toAmountNativeTokenInWei - feeToSave

  if (amountToSwapInWei < BigInt(0) || amountToSwapInWei < feeToSave) {
    return {
      status: 'fail',
      message: `Not enough input amount to cover the future gas fee on the destination chain, 
      or the future gas fee is more than the output token amount`
    }
  }
  
  const swapQuote = await getLifiQuote(
    toChainId,
    toChainId,
    toChainNativeTokenSymbol,
    toToken,
    amountToSwapInWei.toString(),
    fromAddress,
    recipient,
    slippage
  )

  return {
    status: 'success',
    nativeTokenQuote,
    swapQuote
  }
}

export const executeLifiBridgeTransaction = async (
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
  toChainName: string
) => {
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
  const inputAmount = parseUnits(amountIn, fromTokenDecimals).toString()
  const quote: LifiQuoteResponse = await getLifiQuote(
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    inputAmount,
    userEvmAddress,
    recipient,
    slippage
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
        userEvmAddress,
        fromChainId
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
    const result = await executeSwapTransaction(txData, fromChainId, {
      estimateGas: gasLimit > 0 ? false : true,
      gasLimit: gasLimit ? toHex(gasLimit) : undefined
    })

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
        complete_time: new Date().toISOString()
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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

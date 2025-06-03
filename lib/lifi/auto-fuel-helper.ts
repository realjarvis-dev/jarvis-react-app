import { TransactionRequest } from 'ethers'
import { formatUnits, parseUnits, toHex } from 'viem'
import { getGasPriceByChainId } from '../blocknative/get-gas-price'
import { getNativeBalanceByChainId } from '../alchemy/get-token-balance'
import { erc20Approval, executeSwapTransaction } from '../pendle/transactions'

import { chainsById } from '../token-matcher/fuzzy-chain-matcher'

import { LifiQuoteResponse } from '../types/lifi'
import { getLifiQuote } from './api'

const NATIVE_TOKEN_STRING = '0x0000000000000000000000000000000000000000'

const PREDEFINED_GAS_LIMIT = 1000000
const LOWER_BOUND_GAS_LIMIT = 700000
// when user don't have native token on the dest chain, trigger this
const _generateMultiStepQuote = async (
    fromChainId: number,
    fromTokenSymbol: string,
    fromTokenDecimals: number,
    fromAddress: string,
    toChainId: number,
    toChainNativeTokenSymbol: string,
    toTokenSymbol: string,
    toTokenDecimals: number,
    amountIn: string, // in human readable format
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
    const toAmountNativeTokenInWei = BigInt(
      nativeTokenQuote.estimate?.toAmount ?? '0'
    )
    const { maxPriceInMemPool, maxPriorityFeePerGas, maxFeePerGas } = await getGasPriceByChainId(toChainId)
    let gasPrice = maxPriorityFeePerGas + maxFeePerGas
  
    // save some fee for future operations
    const feeToSave = gasPrice * BigInt(PREDEFINED_GAS_LIMIT)
    const amountToSwapInWei = toAmountNativeTokenInWei - feeToSave
    // console.log("gasPrice", gasPrice)
    // console.log("feeToSave", feeToSave)
    // console.log("toAmountNativeToken", formatUnits(toAmountNativeTokenInWei, nativeTokenQuote.action.toToken.decimals))
    // console.log("feeToSave in human readable", formatUnits(feeToSave, nativeTokenQuote.action.toToken.decimals))
    // console.log("amountToSwapInWei", amountToSwapInWei)
    // console.log("amountToSwapInWei in human readable", formatUnits(amountToSwapInWei, nativeTokenQuote.action.toToken.decimals))
  
    if (amountToSwapInWei < BigInt(0) || amountToSwapInWei < feeToSave) {
      return {
        status: 'fail',
        message: `Not enough input amount to cover the future gas fee on the destination chain, 
        or the future gas fee is more than the output token amount`,
        nativeTokenQuote,
        swapQuote: null
      }
    }
  
    const swapQuote = await getLifiQuote(
      toChainId,
      toChainId,
      toChainNativeTokenSymbol,
      toTokenSymbol,
      amountToSwapInWei.toString(),
      fromAddress,
      recipient,
      slippage
    )
  
    const otherFeeArray = [
      ...(nativeTokenQuote.estimate?.feeCosts || []),
      ...(swapQuote.estimate?.feeCosts || [])
    ].map(fee => ({
      name: fee.name,
      symbol: fee.token.symbol,
      chainName: chainsById[fee.token.chainId].name,
      amount: formatUnits(BigInt(fee.amount), fee.token.decimals),
      amountUSD: fee.amountUSD
    }))
    const gasFeeArray = [
      ...(nativeTokenQuote.estimate?.gasCosts || []),
      ...(swapQuote.estimate?.gasCosts || [])
    ].map(gas => ({
      type: gas.type,
      symbol: gas.token.symbol,
      chainName: chainsById[gas.token.chainId].name,
      amount: formatUnits(BigInt(gas.amount), gas.token.decimals),
      amountUSD: gas.amountUSD,
      gasLimit: gas.limit
    }))
    const inAmountParsed = formatUnits(
      BigInt(nativeTokenQuote.estimate?.fromAmount),
      fromTokenDecimals
    )
    const outAmountParsed = formatUnits(
      BigInt(swapQuote.estimate?.toAmount),
      toTokenDecimals
    )
  
    const toChainNativeTokenDecimals = swapQuote.action.fromToken.decimals
  
    const byProductAmount = formatUnits(
      BigInt(feeToSave),
      toChainNativeTokenDecimals
    )
    const byProductAmountMinusGas = formatUnits(
      BigInt(feeToSave) -
        BigInt(
          swapQuote.estimate?.gasCosts?.reduce(
            (acc, curr) => acc + Number(curr.amount),
            0
          ) ?? 0
        ),
      toChainNativeTokenDecimals
    )
  
    const byProductAmountUSD =
      Number(nativeTokenQuote.estimate?.toAmountUSD ?? 0) -
      Number(swapQuote.estimate?.fromAmountUSD ?? 0)
    const byProductAmountMinusGasUSD =
      byProductAmountUSD -
      Number(
        swapQuote.estimate?.gasCosts?.reduce(
          (acc, curr) => acc + Number(curr.amountUSD),
          0
        ) ?? 0
      )
  
    const readableQuote = {
      fromChain: chainsById[fromChainId].name,
      fromChainId: fromChainId,
      fromToken: fromTokenSymbol,
      fromAmountToken: inAmountParsed,
      fromAmountUSD: nativeTokenQuote.estimate?.fromAmountUSD,
      fromTokenAddress: nativeTokenQuote.action.fromToken.address.toLowerCase(),
      isFromNativeToken:
        fromTokenSymbol === '0x0000000000000000000000000000000000000000',
      toChain: chainsById[toChainId].name,
      toChainId: toChainId,
      toToken: toTokenSymbol,
      toAmountToken: outAmountParsed,
      toAmountUSD: swapQuote.estimate?.toAmountUSD,
      gasCosts: gasFeeArray,
      gasCostsUSD: gasFeeArray.reduce(
        (acc, curr) => acc + Number(curr.amountUSD),
        0
      ),
      otherFeeDetails: otherFeeArray,
      otherFeeUSD: otherFeeArray.reduce(
        (acc, curr) => acc + Number(curr.amountUSD),
        0
      ),
      byProductAmount: byProductAmount,
      byProductAmountMinusGas: byProductAmountMinusGas,
      byProductAmountUSD: byProductAmountUSD,
      byProductAmountMinusGasUSD: byProductAmountMinusGasUSD,
      byProductSymbol: toChainNativeTokenSymbol,
      complete_time: new Date().toISOString()
    }
    // console.log("========Native token quote========")
    // console.log(JSON.stringify(nativeTokenQuote, null, 2))
    // console.log("========Swap quote========")
    // console.log(JSON.stringify(swapQuote, null, 2))
  
    return {
      status: 'success',
      message: 'Successfully generated a multi-step quote',
      nativeTokenQuote,
      swapQuote,
      readableQuote
    }
  }
export const executeLifiBridgeTransactionWithAutoFuel = async (
    fromUserAddress: string,
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
  
    const destChain = chainsById[toChainId]
    if (!recipient) {
      recipient = fromUserAddress
    }
    const defaultToTokenDecimals = 18
    const { status, message, nativeTokenQuote, swapQuote, readableQuote } =
      await _generateMultiStepQuote(
        fromChainId,
        fromToken,
        fromTokenDecimals,
        fromUserAddress,
        toChainId,
        destChain.coin,
        toToken,
        defaultToTokenDecimals, // does not matter since we don't display the result, we can use the result from the quote if actually needed
        amountIn,
        slippage,
        recipient
      )
    if (status === 'fail') {
      return {
        success: false,
        details: message
      }
    }
    if (
      !nativeTokenQuote.transactionRequest.to ||
      !swapQuote?.transactionRequest.to
    ) {
      return {
        success: false,
        details: "Li.fi's protocol address not found."
      }
    }
    // console.log("nativeTokenQuote", JSON.stringify(nativeTokenQuote, null, 2))
    // console.log("swapQuote", JSON.stringify(swapQuote, null, 2))
    // collect all the toAddress
    const transactionSteps = [nativeTokenQuote, swapQuote].map(quote => {
      const protocolAddress = quote.transactionRequest.to as string
      const approvalAmount = quote.action.fromAmount
      const needApprovalTokenAddress = quote.action.fromToken.address
      const needApprovalChainId = quote.action.fromToken.chainId
      const isNativeToken = needApprovalTokenAddress === NATIVE_TOKEN_STRING
      const txData = quote.transactionRequest as TransactionRequest
      const gasLimit = BigInt(
        quote.estimate?.gasCosts?.reduce(
          (acc, curr) => acc + Number(curr.limit),
          0
        ) ?? 0
      )
      return {
        protocolAddress,
        needApprovalTokenAddress,
        approvalAmount,
        needApprovalChainId,
        isNativeToken,
        txData,
        gasLimit
      }
    })
  
    try {
      const resultList = []
  
      for (const [index, step] of transactionSteps.entries()) {
        const {
          protocolAddress,
          needApprovalTokenAddress,
          isNativeToken,
          approvalAmount,
          needApprovalChainId,
          txData,
          gasLimit
        } = step
        if (index === 1) {
          // wait until the native token appear on the user's wallet
          // set time out here
          const startTime = Date.now()
          const interval = setInterval(async () => {
            const balance = await getNativeBalanceByChainId(recipient, toChainId)
            if (balance > BigInt(nativeTokenQuote.estimate.toAmountMin)) {
              clearInterval(interval)
              console.log("native token appeared in the user's wallet")
            }
          }, 1000)
          const elapsedMs = Date.now() - startTime
          console.log(
            `Native token appeared after ${elapsedMs} ms (≈ ${(
              elapsedMs / 1000
            ).toFixed(1)} s)`
          )
        }
        if (!isNativeToken) {
          const { status, message } = await erc20Approval(
            needApprovalTokenAddress,
            protocolAddress,
            approvalAmount,
            fromUserAddress,
            needApprovalChainId
          )
          if (status === 'fail') {
            return {
              instruction: 'notify user',
              details: message
            }
          }
        }
        const result = await executeSwapTransaction(txData, needApprovalChainId, {
          estimateGas: gasLimit > 0 ? false : true,
          gasLimit: gasLimit ? toHex(gasLimit) : undefined,
          getGasPriceFunction: getGasPriceByChainId
        })
        resultList.push({
          success: true,
          transaction_hash: result.hash
        })
      }
      return {
        success: true,
        transaction_hash: resultList[0].transaction_hash,
        swap_transaction_hash: resultList[1].transaction_hash,
        swap_details: {
          from_token_symbol: fromToken,
          from_token_address: fromTokenAddress,
          to_token_address: toToken,
          amount_in_human: amountIn,
          from_chain_name: fromChainName,
          to_chain_name: toChainName,
          intermediate_token_symbol: readableQuote.byProductSymbol,
          complete_time: new Date().toISOString()
        }
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : 'Unknown error during transaction execution'
      return {
        instruction: 'notify user',
        details: errorMessage
      }
    }
  }
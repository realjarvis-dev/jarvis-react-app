import { formatUnits, parseUnits, toHex } from 'viem'


import { LifiQuoteResponse, LifiSolanaTransactionRequest } from '../types/lifi'
import { getLifiQuote } from './api'
import { solanaConfig } from '@/lib/network/config'
import { signSolanaTransactionString, broadcastSolanaTransaction } from '@/lib/privy/solana-utils'
import { Connection } from '@solana/web3.js'


export const executeLifiBridgeTransactionSolana = async (
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
    let hash

    if (!recipient) {
      recipient = fromAddress
    }
    const inputAmount = parseUnits(amountIn, fromTokenDecimals).toString()
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

    try {
      const connection = new Connection(solanaConfig.rpcUrl)
      // execute solana transaction
      const signedTransaction = await signSolanaTransactionString((quote.transactionRequest as LifiSolanaTransactionRequest).data, connection)
      hash = await broadcastSolanaTransaction(signedTransaction, connection)


      const explorerLink = solanaConfig.scanLink
      const explorerLinkWithHash = `https://${explorerLink}/tx/${hash}`
      
  
      return {
        success: true,
        transaction_hash: hash,
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
        hash: hash || '',
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
  
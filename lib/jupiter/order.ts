
import axios from 'axios'
import { clusterApiUrl, Connection } from '@solana/web3.js'
import { computeNetworkFeeFromTxString } from './utils'
import { signSolanaTransactionString } from '../privy/solana-utils'
// Create a new axios instance for Jupiter Ultra API
const jupiterUltraAxios = axios.create({
  baseURL: 'https://ultra-api.jup.ag'
})

// Types for Jupiter Ultra API
export interface JupiterOrderRequest {
  inputMint: string
  outputMint: string
  amount: string
  taker?: string
  swapMode: "ExactIn" | "ExactOut"
}

export interface JupiterOrderResponse {
  router: string
  priceImpact: number
  inUsdValue: number
  outUsdValue: number
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  platformFee?: {
    feeBps: number
    amount: string
  }
  dynamicSlippageReport?: {
    amplificationRatio: string | null
    otherAmount: number | null
    simulatedIncurredSlippageBps: number | null
    slippageBps: number
    categoryName: string
    heuristicMaxSlippageBps: number
  }
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string

    }
    percent: number
  }>
  feeMint?: string
  feeBps: number
  prioritizationFeeLamports: number
  swapType: 'aggregator' | 'rfq' | 'hashflow'
  gasless: boolean
  requestId: string
  transaction: string
  totalTime: number
  taker: string | null
  quoteId?: string
  maker?: string
  expireAt?: string

}

export interface JupiterExecuteRequest {
  requestId: string
  signedTransaction: string
}

export interface JupiterExecuteResponse {
  status: "Success" | "Failed"
  signature: string
  slot?: string
  error: string
  code: number
  totalInputAmount?: string
  totalOutputAmount?: string
  inputAmountResult?: string
  outputAmountResult?: string
  swapEvents?: Array<{
    inputMint: string
    inputAmount: string
    outputMint: string
    outputAmount: string
  }>
}

/**
 * Get a base64-encoded unsigned swap transaction from Jupiter Ultra API
 * @param params - Order request parameters
 * @returns Promise with order response containing swap transaction
 */
export async function getJupiterOrder(
  params: JupiterOrderRequest
): Promise<JupiterOrderResponse> {
  try {
    const response = await jupiterUltraAxios.get<JupiterOrderResponse>(
      '/order',
      {
        params
      }
    )

    return response.data
  } catch (error) {
    console.error('Error fetching Jupiter order:', error)
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error('Bad request: Invalid parameters provided')
      } else if (error.response?.status === 500) {
        throw new Error(
          'Internal server error: Jupiter API is experiencing issues'
        )
      }
    }
    throw new Error('Failed to fetch Jupiter order')
  }
}

/**
 * Execute a signed swap transaction via Jupiter Ultra API
 * @param params - Execute request parameters containing requestId and signed transaction
 * @returns Promise with execution response containing transaction status
 */
export async function executeJupiterOrder(
  params: JupiterExecuteRequest
): Promise<JupiterExecuteResponse> {
  try {
    const response = await jupiterUltraAxios.post<JupiterExecuteResponse>(
      '/ultra/v1/execute',
      params
    )

    return response.data
  } catch (error) {
    console.error('Error executing Jupiter order:', error)
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error('Bad request: Invalid transaction or request ID')
      } else if (error.response?.status === 500) {
        throw new Error(
          'Internal server error: Jupiter API is experiencing issues'
        )
      }
    }
    throw new Error('Failed to execute Jupiter order')
  }
}



// console.log(JSON.stringify(await getJupiterOrder({
//     inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
//     outputMint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu",
//     amount: "10000000",
//     taker: "7VkW8pL9ok28CZgB5qDKBU2zNtiwxPw3QKLaEBXqWJ2m",
//     swapMode: "ExactIn"
// }), null, 2))
// const quoteResult = await getJupiterOrder({
//         inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
//         outputMint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu",
//         amount: "10000000",
//         taker: "7VkW8pL9ok28CZgB5qDKBU2zNtiwxPw3QKLaEBXqWJ2m",
//         swapMode: "ExactIn"
//     })
// const connection = new Connection(clusterApiUrl('mainnet-beta'))
// console.log(await signSolanaTransactionString(quoteResult.transaction, connection))
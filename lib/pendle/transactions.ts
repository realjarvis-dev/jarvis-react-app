import {
  getUserEvmWalletAddress,
  getUserWallet,
  privy
} from '@/lib/privy/client'
import axios from 'axios'
import { ethers, TransactionRequest } from 'ethers'
import { v4 as uuidv4 } from 'uuid'

// Types for transaction responses
export interface QuoteResponse {
  amountOut: string
  priceImpact: number
  route: string[]
  fee: string
}

// Native ETH is represented by the zero address in the Pendle API
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
// WETH address on Ethereum mainnet
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

// API base URL
const BASE_URL = 'https://api-v2.pendle.finance/core/v1'

/**
 * Get transaction data for swapping tokens with Pendle
 * @param marketAddress The market address
 * @param tokenOut Address of the output token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @returns Promise with transaction data
 */
export async function getSwapTransaction(
  marketAddress: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01
): Promise<any> {
  try {
    // ETH is always used as the input token
    const actualTokenIn = ETH_ADDRESS

    console.log(`Using market: ${marketAddress}`)
    console.log(`Swapping from ${actualTokenIn} to ${tokenOut}`)

    // // Use environment variable for receiver address, error if not set
    // if (!process.env.WALLET_ADDRESS) {
    //   throw new Error('WALLET_ADDRESS environment variable is not set.')
    // }

    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      throw new Error('EVM wallet not found')
    }

    const RECEIVER = evmWalletAddress
    const chainId = 1

    console.log(`Wallet address: ${RECEIVER}`)
    console.log(`Slippage: ${slippage}`)

    // Use v2 API for swap
    const url = `${BASE_URL}/sdk/${chainId}/markets/${marketAddress}/swap`

    console.log('API URL:', url)
    console.log('Payload:', {
      tokenIn: actualTokenIn,
      tokenOut,
      amountIn,
      slippage,
      receiver: RECEIVER,
      enableAggregator: true
    })

    const response = await axios.get(url, {
      params: {
        tokenIn: actualTokenIn,
        tokenOut: tokenOut,
        amountIn: amountIn,
        slippage: slippage,
        receiver: RECEIVER,
        enableAggregator: true
      }
    })

    if (!response.data || !response.data.tx) {
      throw new Error('No transaction data returned from API')
    }

    console.log('Swap transaction data fetched successfully')
    console.log('Response', response)
    return response.data.tx
  } catch (error: any) {
    console.error('Error fetching swap transaction:', error.message)

    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
    }

    // For development/testing, throw the error instead of returning a mock
    throw new Error(`Failed to get swap transaction: ${error.message}`)
  }
}

/**
 * Executes a transaction with the given transaction data
 * @param txData Transaction data to execute
 * @returns Promise with transaction hash
 */
export async function executeSwapTransaction(
  txData: TransactionRequest,
  chainId: number = 1
): Promise<{ hash: string }> {
  try {
    // // Verify environment variables are set
    // if (!process.env.PRIVATE_KEY) {
    //   throw new Error('PRIVATE_KEY environment variable is not set.')
    // }
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || 'http://127.0.0.1:8545')
    console.log(process.env.ETH_RPC_URL)
    const block = await provider.getBlock('latest')
    const baseFee = block?.baseFeePerGas
    console.log('baseFee', baseFee)
    const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044) // ~2× base fee
    const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip

    console.log('Sending transaction...')
    // console.log('txData', txData)
    const to = txData.to
    const from = txData.from

    const data = txData.data
    const value = txData.value
    const evmWallet = await getUserWallet('ethereum')
    if (!evmWallet) {
      throw new Error('EVM wallet not found')
    }
    if (!evmWallet.id) {
      throw new Error('EVM wallet ID not found')
    }
    const correctNonce = await provider.getTransactionCount(txData.from as `0x${string}`, "pending");


    const weiBig = BigInt(value || '0')
    const quantity = ethers.toQuantity(weiBig)

    // Gas estimation
    const gasEstimate = await provider.estimateGas({
      to: txData.to,
      from: txData.from,
      data: txData.data,
      value: txData.value ?? BigInt(0),
      chainId: chainId
    })
    // Add a 20 % buffer
    const gasLimit = gasEstimate + gasEstimate / BigInt(5)

    // strip the 0x prefix for to, quantity, and data
    const toAddress = (to as string).replace(/^0x/, '')
    const valueHex = quantity.replace(/^0x/, '')
    const dataHex = (data as string).replace(/^0x/, '')
    const fromAddress = (from as string).replace(/^0x/, '')

    const { signedTransaction, encoding } =
      await privy.walletApi.ethereum.signTransaction({
        walletId: evmWallet!.id,
        // caip2: `eip155:1`,
        transaction: {
          to: `0x${toAddress}` as `0x${string}`,
          from: `0x${fromAddress}` as `0x${string}`,
          chainId: chainId,
          value: `0x${valueHex}` as `0x${string}`,
          data: `0x${dataHex}` as `0x${string}`,
          // gasLimit: 650000, //650000
          gasLimit: ethers.toQuantity(gasLimit) as `0x${string}`,
          maxFeePerGas: ethers.toQuantity(maxFee + priority) as `0x${string}`,
          maxPriorityFeePerGas: ethers.toQuantity(priority) as `0x${string}`,
          nonce: correctNonce
        },
        idempotencyKey: uuidv4() // unique key for this transaction
      })

    const txResponse = await provider.broadcastTransaction(signedTransaction)
    // 4. Inspect the response
    console.log('Transaction hash:', txResponse.hash)
    // You can then wait for confirmation:
    const receipt = await txResponse.wait()
    if (receipt) {
      console.log('Mined in block', receipt.blockNumber)
    }

    return {
      hash: txResponse.hash
    }
  } catch (error: any) {
    console.error('Error executing transaction:', error.message)
    throw new Error(`Failed to execute transaction: ${error.message}`)
  }
}

/**
 * Get transaction data for swapping ETH to a specific token
 * @param marketAddress The market address
 * @param tokenOutAddress Address of the output token
 * @param amountIn Amount of ETH in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @returns Promise with transaction result
 */
export async function getSwapEthToTokenTransaction(
  marketAddress: string,
  tokenOutAddress: string,
  amountIn: string,
  slippage: number = 0.01
): Promise<any> {
  try {
    // Get the transaction data - ETH is hardcoded as input token in getSwapTransaction
    const txData = await getSwapTransaction(
      marketAddress,
      tokenOutAddress,
      amountIn,
      slippage
    )

    return txData
  } catch (error: any) {
    console.error('Error getting swap transaction data:', error.message)
    throw new Error(`Failed to get swap transaction data: ${error.message}`)
  }
}

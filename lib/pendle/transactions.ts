import {
  getUserEvmWalletAddress,
  getUserWallet,
  privy
} from '@/lib/privy/client'
import axios from 'axios'
import { ethers, TransactionRequest } from 'ethers'
import { v4 as uuidv4 } from 'uuid'
import { getConfigByChainId } from '../config/network'

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
 * @param tokenIn Address of the input token
 * @param tokenOut Address of the output token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @returns Promise with transaction data
 */
export async function getSwapTransactionFromPendle(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01
): Promise<any> {
  try {
    console.log(`Using market: ${marketAddress}`)
    console.log(`Swapping from ${tokenIn} to ${tokenOut}`)

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
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      receiver: RECEIVER,
      enableAggregator: true
    })

    const response = await axios.get(url, {
      params: {
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
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

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export async function getERC20Details (
  tokenAddress: string,
  chainId: number = 1
): Promise<{ decimals: number, symbol: string, name: string }> {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || getConfigByChainId(chainId).rpcUrl);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [decimals, symbol, name] = await Promise.all([
    tokenContract.decimals(),
    tokenContract.symbol(),
    tokenContract.name()
  ]);
  return { decimals, symbol, name };
  } catch (error: any) {
    console.error('Error fetching ERC20 details:', error.message)
    throw new Error(`Failed to get ERC20 details: ${error.message}`)
  }
}

export async function erc20Approval (
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  userAddress: string,
  chainId: number = 1
): Promise<{ status: string, message?: string }> {
    // default to use the ETH_RPC_URL in env
    // on localhost can put 127.0.0.1:8545 for local testing
    // TODO: on deployment have to remove the ETH_RPC_URL for multichain support
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || getConfigByChainId(chainId).rpcUrl);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(userAddress, spenderAddress);
    
    // Skip approval if allowance is sufficient
    if (allowance >= BigInt(amount)) {
      return { status: 'success', message: 'Allowance is sufficient' };
    }
    
    // Generate approval transaction
    const approvalData = tokenContract.interface.encodeFunctionData('approve', [
      spenderAddress,
      amount
    ]);

    try {
      const txData = await executeSwapTransaction({
        to: tokenAddress,
        from: userAddress,
        data: approvalData,
        value: BigInt(0)
      }, chainId)
      return { status: 'success', message: txData.hash }
    } catch (error: any) {
      return { status: 'fail', message: error.message }
    }





}

// TODO: add an option to support no gas estimation since kodiak deposit can't be estimated
/**
 * Executes a transaction with the given transaction data
 * @param txData Transaction data to execute
 * @param chainId Chain ID
 * @param gasOptions Gas options
 * @param gasLimit Gas limit
 * @param estimateGas If or not to estimate gas
 * @returns Promise with transaction hash
 */
export async function executeSwapTransaction(
  txData: TransactionRequest,
  chainId: number = 1,
  gasOptions?: {
    gasLimit?: `0x${string}`,
    estimateGas: boolean
  }
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
    let gasLimit: `0x${string}`

    const estimateGas = gasOptions?.estimateGas !== false; // Default to true if not specified or explicitly true
    if (estimateGas) {
      // Gas estimation
      const gasEstimate = await provider.estimateGas({
        to: txData.to,
        from: txData.from,
        data: txData.data,
        value: txData.value ?? BigInt(0),
        chainId: chainId
      })
      // Add a 20 % buffer
      gasLimit = ethers.toQuantity(gasEstimate + gasEstimate / BigInt(5)) as `0x${string}`
    } else {
      gasLimit = gasOptions?.gasLimit ?? ethers.toQuantity(650000) as `0x${string}`
    }

    // strip the 0x prefix for to, quantity, and data
    const toAddress = (to as string).replace(/^0x/, '')
    const valueHex = quantity.replace(/^0x/, '')
    const dataHex = (data as string).replace(/^0x/, '')
    const fromAddress = (from as string).replace(/^0x/, '')

    console.log('gasLimit', gasLimit)
    console.log("valueHex", valueHex)

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
          gasLimit: gasLimit,
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

// /**
//  * Get transaction data for swapping ETH to a specific token
//  * @param marketAddress The market address
//  * @param tokenOutAddress Address of the output token
//  * @param amountIn Amount of ETH in wei
//  * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
//  * @returns Promise with transaction result
//  */
// export async function getSwapEthToTokenTransaction(
//   marketAddress: string,
//   tokenOutAddress: string,
//   amountIn: string,
//   slippage: number = 0.01
// ): Promise<any> {
//   try {
//     // Get the transaction data - ETH is hardcoded as input token in getSwapTransaction
//     const txData = await getSwapTransaction(
//       marketAddress,
//       tokenOutAddress,
//       amountIn,
//       slippage
//     )

//     return txData
//   } catch (error: any) {
//     console.error('Error getting swap transaction data:', error.message)
//     throw new Error(`Failed to get swap transaction data: ${error.message}`)
//   }
// }

import {
  getUserEvmWalletAddress,
  getUserWallet,
  privy
} from '@/lib/privy/client'
import { ethers, parseUnits, TransactionRequest } from 'ethers'
import { v4 as uuidv4 } from 'uuid'
import { getGasPriceByChainId } from '../blocknative/get-gas-price'
import { getProposedGasPrice } from '../etherscan/gas-price'
import { getConfigByChainId } from '../network/config'

// Custom error for transaction failures
export class TransactionError extends Error {
  hash?: string

  constructor(message: string, hash?: string) {
    super(message)
    this.name = 'TransactionError'
    this.hash = hash

    // This is necessary for correctly setting the prototype in environments like Node.js
    Object.setPrototypeOf(this, TransactionError.prototype)
  }
}

/**
 * Sign transaction using Privy wallet with advanced gas estimation
 *
 * @param txData Transaction data object
 * @param chainId Chain ID
 * @param gasOptions Gas estimation options
 * @param isDemo Whether this is a demo transaction
 * @returns Signed transaction and provider
 */
export async function signTransaction(
  txData: TransactionRequest,
  chainId: number,
  gasOptions?: {
    estimateGas: boolean
    gasLimit?: `0x${string}`
    eip1559GasPriceFunction?: (chainId: number) => Promise<{
      maxPriceInMemPool: bigint
      maxPriorityFeePerGas: bigint
      maxFeePerGas: bigint
    }>
    legacyGasPriceFunction?: (chainId: number) => Promise<number>
  },
  isDemo: boolean = false
) {
  // Get EVM wallet and user address
  const evmWallet = await getUserWallet('ethereum')
  if (!evmWallet || !evmWallet.id) {
    throw new Error('EVM wallet not found')
  }

  const userAddress = await getUserEvmWalletAddress()
  if (!userAddress) {
    throw new Error('User address not found')
  }

  // Set default gas options if not provided
  if (!gasOptions) {
    gasOptions = {
      estimateGas: true,
      eip1559GasPriceFunction: getGasPriceByChainId,
      legacyGasPriceFunction: getProposedGasPrice
    }
  }
  if (!gasOptions?.eip1559GasPriceFunction) {
    gasOptions.eip1559GasPriceFunction = getGasPriceByChainId
  }
  if (!gasOptions?.legacyGasPriceFunction) {
    gasOptions.legacyGasPriceFunction = getProposedGasPrice
  }

  // Get provider for gas estimation
  const provider = new ethers.JsonRpcProvider(
    process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
  )

  // Get latest block for base fee calculation
  const block = await provider.getBlock('latest')
  const baseFee = block?.baseFeePerGas
  const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044) // ~2× base fee
  const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip
  let maxFeePerGas = maxFee + priority
  let maxPriorityFeePerGas = priority

  // Handle legacy gas mode chains (e.g., BNB Smart Chain)
  const isLegacyGasModeChain = [56].includes(chainId)
  let fixGasPrice: bigint = BigInt(0)
  if (isLegacyGasModeChain) {
    fixGasPrice = parseUnits(
      (await gasOptions.legacyGasPriceFunction(chainId)).toString(),
      9
    )
    console.log('Fetch legacy gas price', fixGasPrice)
  } else {
    const estimateGasPrice = await gasOptions.eip1559GasPriceFunction(chainId)
    maxFeePerGas = estimateGasPrice.maxFeePerGas
    maxPriorityFeePerGas = estimateGasPrice.maxPriorityFeePerGas
  }

  // Get current nonce
  const nonce = await provider.getTransactionCount(
    userAddress as `0x${string}`,
    'pending'
  )

  // Handle gas limit estimation
  let gasLimit: `0x${string}`
  let estimateGas = gasOptions?.estimateGas !== false // Default to true if not specified

  if (isDemo) {
    estimateGas = false
    chainId = 1
  }

  if (estimateGas) {
    // Gas estimation with buffer
    const gasEstimate = await provider.estimateGas({
      to: txData.to,
      from: txData.from,
      data: txData.data,
      value: txData.value || BigInt(0),
      chainId: chainId
    })
    // Add 20% buffer to gas estimate
    gasLimit = ethers.toQuantity(
      gasEstimate + gasEstimate / BigInt(5)
    ) as `0x${string}`
  } else {
    gasLimit =
      gasOptions?.gasLimit ?? (ethers.toQuantity(1000000) as `0x${string}`)
  }

  // Convert value to hex quantity
  const weiBig = BigInt(txData.value || '0')
  const quantity = ethers.toQuantity(weiBig)

  // Prepare transaction data
  const to = txData.to
  const from = txData.from
  const data = txData.data

  // strip the 0x prefix for to, quantity, and data
  const toAddress = (to as string).replace(/^0x/, '')
  const valueHex = quantity.replace(/^0x/, '')
  const dataHex = (data as string).replace(/^0x/, '')
  const fromAddress = (from as string).replace(/^0x/, '')

  // Sign transaction with Privy based on chain type
  let signedTransaction: string
  let encoding: string

  if (isLegacyGasModeChain) {
    console.log('gasLimit', gasLimit)
    console.log('fixGasPrice', fixGasPrice)
    console.log('correctNonce', nonce)
    console.log('chainId', chainId)
    console.log(
      'rpc url',
      process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
    )

    const res = await privy.walletApi.ethereum.signTransaction({
      walletId: evmWallet.id,
      transaction: {
        to: `0x${toAddress}` as `0x${string}`,
        from: `0x${fromAddress}` as `0x${string}`,
        chainId: chainId,
        value: `0x${valueHex}` as `0x${string}`,
        data: `0x${dataHex}` as `0x${string}`,
        gasLimit: gasLimit,
        type: 0,
        // only set gasPrice for legacy gas mode chains (BNB Smart Chain)
        gasPrice: ethers.toQuantity(fixGasPrice) as `0x${string}`,
        nonce: nonce
      },
      idempotencyKey: uuidv4()
    })
    signedTransaction = res.signedTransaction
    encoding = res.encoding
  } else {
    const res = await privy.walletApi.ethereum.signTransaction({
      walletId: evmWallet.id,
      transaction: {
        to: `0x${toAddress}` as `0x${string}`,
        from: `0x${fromAddress}` as `0x${string}`,
        chainId: chainId,
        value: `0x${valueHex}` as `0x${string}`,
        data: `0x${dataHex}` as `0x${string}`,
        gasLimit: gasLimit,
        // set maxFeePerGas and maxPriorityFeePerGas for EIP-1559 chains
        maxFeePerGas: ethers.toQuantity(maxFeePerGas) as `0x${string}`,
        maxPriorityFeePerGas: ethers.toQuantity(
          maxPriorityFeePerGas
        ) as `0x${string}`,
        nonce: nonce
      },
      idempotencyKey: uuidv4()
    })
    signedTransaction = res.signedTransaction
    encoding = res.encoding
  }

  return {
    signedTransaction,
    provider
  }
}

/**
 * Broadcast signed transaction and wait for confirmation
 *
 * @param signedTransaction Signed transaction from signTransaction
 * @param provider Ethereum provider
 * @returns Transaction response with hash
 */
export async function broadcastTransaction(
  signedTransaction: string,
  provider: ethers.JsonRpcProvider
) {
  let hash: string | null = null
  try {
    // Broadcast the transaction
    const txResponse = await provider.broadcastTransaction(signedTransaction)
    hash = txResponse.hash

    // Wait for confirmation
    const receipt = await txResponse.wait()

    return {
      hash: txResponse.hash
    }
  } catch (error: any) {
    console.error('Error executing transaction:', error.message)
    if (hash) {
      throw new TransactionError(
        `Failed to execute transaction (hash: ${hash}): ${error.message}`,
        hash
      )
    } else {
      throw new TransactionError(
        `Failed to execute transaction: ${error.message}`
      )
    }
  }
}

/**
 * Execute transaction using Privy wallet with advanced gas estimation
 *
 * @example
 * // Example usage for a swap transaction:
 * const result = await executeTransaction(
 *   {
 *     to: swapResult.tx.to,
 *     from: userAddress,
 *     data: swapResult.tx.data,
 *     value: swapResult.tx.value || '0'
 *   },
 *   userAddress,
 *   evmWalletId,
 *   1, // chainId
 *   {
 *     estimateGas: true,
 *     getGasPriceFunction: getGasPriceByChainId // Optional: for custom gas pricing
 *   },
 *   false // isDemo
 * );
 *
 * @example
 * // Example usage with fixed gas limit for demo:
 * const result = await executeTransaction(
 *   txData,
 *   userAddress,
 *   evmWalletId,
 *   1,
 *   {
 *     estimateGas: false,
 *     gasLimit: ethers.toQuantity(1000000) as `0x${string}`
 *   },
 *   true // isDemo
 * );
 *
 * @param txData Transaction data object
 * @param userAddress User's wallet address
 * @param evmWalletId EVM wallet ID from Privy
 * @param chainId Chain ID
 * @param gasOptions Gas estimation options
 * @param isDemo Whether this is a demo transaction
 * @returns Transaction response with hash
 */
export async function executeTransaction(
  txData: TransactionRequest,
  chainId: number,
  gasOptions?: {
    estimateGas: boolean
    gasLimit?: `0x${string}`
    getGasPriceFunction?: (chainId: number) => Promise<{
      maxPriceInMemPool: bigint
      maxPriorityFeePerGas: bigint
      maxFeePerGas: bigint
    }>
  },
  isDemo: boolean = false
) {
  try {
  // Sign the transaction
  const { signedTransaction, provider } = await signTransaction(
    txData,
    chainId,
    gasOptions,
    isDemo
  )

  // Broadcast the transaction
  return await broadcastTransaction(signedTransaction, provider)
  } catch (error) {
    console.error('Error executing transaction:', error)
    throw error
  }
}

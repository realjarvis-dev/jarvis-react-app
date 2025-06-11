import { getConfigByChainId } from '@/lib/network/config'
import {
  getUserEvmWalletAddress,
  getUserWallet,
  privy
} from '@/lib/privy/client'
import axios from 'axios'
import { ethers, TransactionRequest } from 'ethers'
import { v4 as uuidv4 } from 'uuid'

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
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)'
]

export async function getERC20Details(
  tokenAddress: string,
  chainId: number = 1
): Promise<{ decimals: number; symbol: string; name: string }> {
  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.TEST_RPC_URL || getConfigByChainId(chainId, false).rpcUrl
    )
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const [decimals, symbol, name] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.name()
    ])
    return { decimals, symbol, name }
  } catch (error: any) {
    console.error('Error fetching ERC20 details:', error.message)
    throw new Error(`Failed to get ERC20 details: ${error.message}`)
  }
}

/**
 * Transfer ERC20 token
 * @param tokenAddress Address of the token to transfer
 * @param toAddress Address of the recipient
 * @param amount Amount of token to transfer in wei
 * @param userAddress Address of the user
 * @param chainId Chain ID
 * @param isDemo If the transaction is for demo
 * @returns Promise with transaction hash
 */
export async function erc20Transfer(
  tokenAddress: string,
  toAddress: string,
  amount: string,
  userAddress: string,
  chainId: number = 1,
  isDemo: boolean = false
): Promise<{ status: string; hash?: string; message?: string }> {
  const provider = new ethers.JsonRpcProvider(
    process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
  )
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  const transferData = tokenContract.interface.encodeFunctionData('transfer', [
    toAddress,
    amount
  ])
  let txData;
  try {
    if (!isDemo) {
    txData = await executeSwapTransaction(
      {
        to: tokenAddress,
        from: userAddress,
        data: transferData,
        value: BigInt(0)
      },
      chainId, {
        estimateGas: true
      },
      isDemo
      )
    } else {
      txData = await executeSwapTransaction(
        {
          to: tokenAddress,
          from: userAddress,
          data: transferData,
          value: BigInt(0)
        },
        chainId,
        {
          estimateGas: false,
          gasLimit: ethers.toQuantity(1000000) as `0x${string}`
        },
        isDemo
      )
    }

    return { status: 'success', hash: txData.hash }
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return { status: 'fail', message: error.message, hash: error.hash }
    }
    return { status: 'fail', message: (error as Error).message }
  }
}

export async function erc20Approval(
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  userAddress: string,
  chainId: number = 1,
  isDemo: boolean
): Promise<{ status: string; hash?: string; message?: string }> {
  // default to use the TEST_RPC_URL in env
  // on localhost can put 127.0.0.1:8545 for local testing
  // TODO: on deployment have to remove the TEST_RPC_URL for multichain support
  const provider = new ethers.JsonRpcProvider(
    process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
  )
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  const allowance = await tokenContract.allowance(userAddress, spenderAddress)

  // Skip approval if allowance is sufficient
  if (allowance >= BigInt(amount)) {
    return { status: 'success', message: 'Allowance is sufficient' }
  }

  // Generate approval transaction
  const approvalData = tokenContract.interface.encodeFunctionData('approve', [
    spenderAddress,
    amount
  ])

  try {
    const txData = await executeSwapTransaction(
      {
        to: tokenAddress,
        from: userAddress,
        data: approvalData,
        value: BigInt(0)
      },
      chainId
    )
    return { status: 'success', hash: txData.hash }
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return { status: 'fail', message: error.message, hash: error.hash }
    }
    return { status: 'fail', message: (error as Error).message }
  }
}

// TODO: add an option to support no gas estimation since kodiak deposit can't be estimated
/**
 * Executes a transaction with the given transaction data
 * @param txData Transaction data to execute
 * @param chainId Chain ID
 * @param gasOptions Gas options
 * @param gasLimit Hardcoded gas limit, please set estimateGas to false if use the provided gasLimit
 * @param estimateGas If or not to estimate gas in executeSwapTransaction function using ether's estimateGas
 * @param getGasPriceFunction Function to get estimated gas price by chain Id
 * @returns Promise with transaction hash
 */
export async function executeSwapTransaction(
  txData: TransactionRequest,
  chainId: number = 1,
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
): Promise<{ hash: string }> {
  let hash: string | null = null
  try {
    // // Verify environment variables are set
    // if (!process.env.PRIVATE_KEY) {
    //   throw new Error('PRIVATE_KEY environment variable is not set.')
    // }
    let provider: ethers.JsonRpcProvider
    provider = new ethers.JsonRpcProvider(
      process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
    )
    // console.log("RPC URL",  process.env.TEST_RPC_URL || getConfigByChainId(chainId).rpcUrl)
    // console.log(getConfigByChainId(chainId).rpcUrl)
    const block = await provider.getBlock('latest')
    const baseFee = block?.baseFeePerGas
    console.log('baseFee', baseFee)
    const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044) // ~2× base fee
    const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip
    let maxFeePerGas = maxFee + priority
    let maxPriorityFeePerGas = priority
    if (gasOptions?.getGasPriceFunction) {
      const estimateGasPrice = await gasOptions.getGasPriceFunction(chainId)
      maxFeePerGas = estimateGasPrice.maxFeePerGas
      maxPriorityFeePerGas = estimateGasPrice.maxPriorityFeePerGas
    }

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
    const correctNonce = await provider.getTransactionCount(
      txData.from as `0x${string}`,
      'pending'
    )

    const weiBig = BigInt(value || '0')
    const quantity = ethers.toQuantity(weiBig)
    let gasLimit: `0x${string}`

    let estimateGas = gasOptions?.estimateGas !== false // Default to true if not specified or explicitly true
    if (isDemo) {
      estimateGas = false
      chainId = 1
    }
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
      gasLimit = ethers.toQuantity(
        gasEstimate + gasEstimate / BigInt(5)
      ) as `0x${string}`
    } else {
      gasLimit =
        gasOptions?.gasLimit ?? (ethers.toQuantity(1000000) as `0x${string}`)
    }

    // strip the 0x prefix for to, quantity, and data
    const toAddress = (to as string).replace(/^0x/, '')
    const valueHex = quantity.replace(/^0x/, '')
    const dataHex = (data as string).replace(/^0x/, '')
    const fromAddress = (from as string).replace(/^0x/, '')
    console.log('fromAddress', fromAddress)
    console.log('toAddress', toAddress)
    console.log('dataHex', dataHex)
    console.log('valueHex', valueHex)

    console.log('gasOptions', gasOptions)
    console.log('gasLimit', gasLimit)
    console.log('valueHex', valueHex)
    console.log('chainId', chainId)
    console.log('maxFeePerGas', maxFeePerGas)
    console.log('maxPriorityFeePerGas', maxPriorityFeePerGas)

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
          // gasPrice: gasOptions?.gasPrice ?? undefined,
          maxFeePerGas: ethers.toQuantity(maxFeePerGas) as `0x${string}`,
          maxPriorityFeePerGas: ethers.toQuantity(
            maxPriorityFeePerGas
          ) as `0x${string}`,
          nonce: correctNonce
        },
        idempotencyKey: uuidv4() // unique key for this transaction
      })

    const txResponse = await provider.broadcastTransaction(signedTransaction)
    hash = txResponse.hash
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
 * Get transaction data for redeeming PT & YT to tokens with Pendle
 * @param ytAddress The YT token address
 * @param amountIn Amount to redeem in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID (defaults to 1 for Ethereum mainnet)
 * @param enableAggregator Whether to enable swap aggregator
 * @returns Promise with transaction data
 */
export async function getRedeemTransactionFromPendle(
  ytAddress: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number = 1,
  enableAggregator: boolean = true
): Promise<any> {
  try {
    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      throw new Error('EVM wallet not found')
    }

    const RECEIVER = evmWalletAddress
    
    // Handle amount in a way that's safe for very large numbers and expired tokens
    // Convert to BigInt and back to string to avoid scientific notation
    const safeAmountIn = BigInt(amountIn).toString();
    
    // Use redeem API endpoint
    const url = `${BASE_URL}/sdk/${chainId}/redeem`

    const response = await axios.get(url, {
      params: {
        yt: ytAddress,
        amountIn: safeAmountIn,
        tokenOut: ETH_ADDRESS,
        slippage,
        receiver: RECEIVER,
        enableAggregator
      }
    })

    if (!response.data || !response.data.tx) {
      throw new Error('No transaction data returned from API')
    }

    return response.data.tx
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Failed to get redeem transaction: ${error.message}`)
    }
    
    throw new Error(`Failed to get redeem transaction: ${error.message}`)
  }
}

/**
 * Get transaction data for redeeming rewards and interests from positions
 * @param sysAddresses Array of SY addresses (optional)
 * @param ytsAddresses Array of YT addresses (optional)
 * @param marketsAddresses Array of market addresses (optional)
 * @param chainId Chain ID (defaults to 1 for Ethereum mainnet)
 * @returns Promise with transaction data
 */
export async function getRedeemInterestsAndRewardsTransactionFromPendle(
  sysAddresses?: string[],
  ytsAddresses?: string[],
  marketsAddresses?: string[],
  chainId: number = 1
): Promise<any> {
  try {
    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      throw new Error('EVM wallet not found')
    }

    const RECEIVER = evmWalletAddress

    // Convert arrays to comma-separated strings if provided
    const sys = sysAddresses?.join(',')
    const yts = ytsAddresses?.join(',')
    const markets = marketsAddresses?.join(',')

    // Use redeem-interests-and-rewards API endpoint
    const url = `${BASE_URL}/sdk/${chainId}/redeem-interests-and-rewards`

    const params: any = { receiver: RECEIVER }
    if (sys) params.sys = sys
    if (yts) params.yts = yts
    if (markets) params.markets = markets

    const response = await axios.get(url, { params })
    
    if (!response.data || !response.data.tx) {
      throw new Error('No transaction data returned from API')
    }

    return response.data.tx
  } catch (error: any) {
    throw new Error(`Failed to get redeem interests and rewards transaction: ${error.message}`)
  }
}

/**
 * Execute a redeem transaction to redeem PT & YT to tokens
 * @param ytAddress The YT token address
 * @param amountIn Amount to redeem in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID (defaults to 1 for Ethereum mainnet)
 * @param enableAggregator Whether to enable swap aggregator
 * @param isDemo Whether this is a demo transaction
 * @returns Promise with transaction status and hash
 */
export async function executeRedeemTransaction(
  ytAddress: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number = 1,
  enableAggregator: boolean = true,
  isDemo: boolean = false
): Promise<{ status: string; hash?: string; message?: string; amountOut?: string }> {
  try {
    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      return {
        status: 'fail',
        message: 'EVM wallet not found'
      }
    }

    // Get transaction data
    const txData = await getRedeemTransactionFromPendle(
      ytAddress,
      amountIn,
      slippage,
      chainId,
      enableAggregator
    );

    if (!txData) {
      return {
        status: 'fail',
        message: 'Failed to prepare redeem transaction data'
      };
    }

    // Handle token approvals exactly as shown in the sample payload
    if (txData.tokenApprovals && txData.tokenApprovals.length > 0) {
      for (const approval of txData.tokenApprovals) {
        // Each approval has token and amount properties
        const approvalResult = await erc20Approval(
          approval.token,
          txData.to,
          approval.amount,
          evmWalletAddress,
          chainId,
          isDemo
        );
        
        if (approvalResult.status === 'fail') {
          return {
            status: 'fail',
            message: `ERC20 approval failed for token ${approval.token}: ${approvalResult.message}`
          };
        }
      }
    }

    // Execute the transaction
    const result = await executeSwapTransaction(
      txData,
      chainId,
      { estimateGas: true },
      isDemo
    );

    return {
      status: 'success',
      hash: result.hash,
      amountOut: txData.data?.amountOut
    };
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return {
        status: 'fail',
        message: error.message,
        hash: error.hash
      };
    }
    
    return {
      status: 'fail',
      message: error.message
    };
  }
}

/**
 * Execute a transaction to redeem interests and rewards
 * @param sysAddresses Array of SY addresses (optional)
 * @param ytsAddresses Array of YT addresses (optional)
 * @param marketsAddresses Array of market addresses (optional)
 * @param chainId Chain ID (defaults to 1 for Ethereum mainnet)
 * @param isDemo Whether this is a demo transaction
 * @returns Promise with transaction status and hash
 */
export async function executeRedeemInterestsAndRewardsTransaction(
  sysAddresses?: string[],
  ytsAddresses?: string[],
  marketsAddresses?: string[],
  chainId: number = 1,
  isDemo: boolean = false
): Promise<{ status: string; hash?: string; message?: string }> {
  try {
    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      return {
        status: 'fail',
        message: 'EVM wallet not found'
      }
    }

    // Get transaction data
    const txData = await getRedeemInterestsAndRewardsTransactionFromPendle(
      sysAddresses,
      ytsAddresses,
      marketsAddresses,
      chainId
    )

    if (!txData) {
      return {
        status: 'fail',
        message: 'Failed to prepare redeem interests and rewards transaction data'
      }
    }

    // Handle token approvals if needed
    if (txData.tokenApprovals && txData.tokenApprovals.length > 0) {
      for (const approval of txData.tokenApprovals) {
        const approvalResult = await erc20Approval(
          approval.token,
          txData.to,
          approval.amount,
          evmWalletAddress,
          chainId,
          isDemo
        )
        
        if (approvalResult.status === 'fail') {
          return {
            status: 'fail',
            message: `ERC20 approval failed: ${approvalResult.message}`
          }
        }
      }
    }

    // Execute the transaction
    const result = await executeSwapTransaction(
      txData,
      chainId,
      { estimateGas: true },
      isDemo
    )

    return {
      status: 'success',
      hash: result.hash
    }
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return {
        status: 'fail',
        message: error.message,
        hash: error.hash
      }
    }
    
    return {
      status: 'fail',
      message: error.message
    }
  }
}




import {
  getUserEvmWalletAddress,
} from '@/lib/privy/client'
import axios from 'axios'
import { getPendleMarkets } from '../pendle/api'
import { erc20Approval, executeTransaction } from '../privy/utils'

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
  slippage: number = 0.01,
  chainId: number
): Promise<any> {
  try {
    console.log(`Using market: ${marketAddress}`)
    console.log(`Swapping from ${tokenIn} to ${tokenOut}`)

    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      throw new Error('EVM wallet not found')
    }

    const RECEIVER = evmWalletAddress


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





// // TODO: add an option to support no gas estimation since kodiak deposit can't be estimated
// /**
//  * Executes a transaction with the given transaction data
//  * @param txData Transaction data to execute
//  * @param chainId Chain ID
//  * @param gasOptions Gas options
//  * @param gasLimit Hardcoded gas limit, please set estimateGas to false if use the provided gasLimit
//  * @param estimateGas If or not to estimate gas in executeSwapTransaction function using ether's estimateGas
//  * @param getGasPriceFunction Function to get estimated gas price by chain Id
//  * @returns Promise with transaction hash
//  */
// export async function executeSwapTransaction(
//   txData: TransactionRequest,
//   chainId: number,
//   gasOptions?: {
//     estimateGas: boolean
//     gasLimit?: `0x${string}`
//     eip1559GasPriceFunction?: (chainId: number) => Promise<{
//       maxPriceInMemPool: bigint
//       maxPriorityFeePerGas: bigint
//       maxFeePerGas: bigint
//     }>
//     legacyGasPriceFunction?: (chainId: number) => Promise<number>
//   },
//   isDemo: boolean = false
// ): Promise<{ hash: string }> {
//   let hash: string | null = null
//   if (!gasOptions) {
//     gasOptions = {
//       estimateGas: true,
//       eip1559GasPriceFunction: getGasPriceByChainId,
//       legacyGasPriceFunction: getProposedGasPrice
//     }
//   }
//   if (!gasOptions?.eip1559GasPriceFunction) {
//     gasOptions.eip1559GasPriceFunction = getGasPriceByChainId
//   }
//   if (!gasOptions?.legacyGasPriceFunction) {
//     gasOptions.legacyGasPriceFunction = getProposedGasPrice
//   }
//   try {
//     let provider: ethers.JsonRpcProvider
//     const rpcUrl = process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
//     provider = new JsonRpcProvider(rpcUrl)
//     const block = await provider.getBlock('latest')
//     const baseFee = block?.baseFeePerGas
//     const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044) // ~2× base fee
//     const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip
//     let maxFeePerGas = maxFee + priority
//     let maxPriorityFeePerGas = priority
//     const isLegacyGasModeChain = [56].includes(chainId)
//     let fixGasPrice: bigint = BigInt(0)
//     if (isLegacyGasModeChain) {
//       fixGasPrice = parseUnits((await gasOptions.legacyGasPriceFunction(chainId)).toString(), 9)
//       console.log("Fetch legacy gas price", fixGasPrice)
//     }
//     else {
//       const estimateGasPrice = await gasOptions.eip1559GasPriceFunction(chainId)
//       maxFeePerGas = estimateGasPrice.maxFeePerGas
//       maxPriorityFeePerGas = estimateGasPrice.maxPriorityFeePerGas
//     }

//     const to = txData.to
//     const from = txData.from
//     const data = txData.data
//     const value = txData.value
//     const evmWallet = await getUserWallet('ethereum')
//     if (!evmWallet) {
//       throw new Error('EVM wallet not found')
//     }
//     if (!evmWallet.id) {
//       throw new Error('EVM wallet ID not found')
//     }
//     const correctNonce = await provider.getTransactionCount(
//       txData.from as `0x${string}`,
//       'pending'
//     )

//     const weiBig = BigInt(value || '0')
//     const quantity = ethers.toQuantity(weiBig)
//     let gasLimit: `0x${string}`

//     let estimateGas = gasOptions?.estimateGas !== false // Default to true if not specified or explicitly true
//     if (isDemo) {
//       estimateGas = false
//       chainId = networkContext?.selectedChainId!
//     }
//     if (estimateGas) {
//       // Gas estimation
//       const gasEstimate = await provider.estimateGas({
//         to: txData.to,
//         from: txData.from,
//         data: txData.data,
//         value: txData.value ?? BigInt(0),
//         chainId: chainId
//       })
//       // Add a 20% buffer
//       gasLimit = ethers.toQuantity(
//         gasEstimate + gasEstimate / BigInt(5)
//       ) as `0x${string}`
//     } else {
//       gasLimit =
//         gasOptions?.gasLimit ?? (ethers.toQuantity(1000000) as `0x${string}`)
//     }

//     // strip the 0x prefix for to, quantity, and data
//     const toAddress = (to as string).replace(/^0x/, '')
//     const valueHex = quantity.replace(/^0x/, '')
//     const dataHex = (data as string).replace(/^0x/, '')
//     const fromAddress = (from as string).replace(/^0x/, '')

//     let signedTransaction: string
//     let encoding: string
//     if (isLegacyGasModeChain) {
//       console.log("gasLimit", gasLimit)
//       console.log("fixGasPrice", fixGasPrice)
//       console.log("correctNonce", correctNonce)
//       console.log("chainId", chainId)
//       console.log("rpc url", process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl)
//       const res = await privy.walletApi.ethereum.signTransaction({
//         walletId: evmWallet!.id,
//         transaction: {
//           to: `0x${toAddress}` as `0x${string}`,
//           from: `0x${fromAddress}` as `0x${string}`,
//           chainId: chainId,
//           value: `0x${valueHex}` as `0x${string}`,
//           data: `0x${dataHex}` as `0x${string}`,
//           gasLimit: gasLimit,
//           type: 0,
//           // only set gasPrice for legacy gas mode chains (BNB Smart Chain)
//           gasPrice: ethers.toQuantity(fixGasPrice) as `0x${string}`,        
//           nonce: correctNonce
//         },
//         idempotencyKey: uuidv4() // unique key for this transaction
//       })
//       signedTransaction = res.signedTransaction
//       encoding = res.encoding
//     }
//     else {
      
//       const res =
//       await privy.walletApi.ethereum.signTransaction({
//         walletId: evmWallet!.id,
//         transaction: {
//           to: `0x${toAddress}` as `0x${string}`,
//           from: `0x${fromAddress}` as `0x${string}`,
//           chainId: chainId,
//           value: `0x${valueHex}` as `0x${string}`,
//           data: `0x${dataHex}` as `0x${string}`,
//           gasLimit: gasLimit,
//           // set maxFeePerGas and maxPriorityFeePerGas for EIP-1559 chains (Ethereum, Unichain, Sonic)
//           maxFeePerGas: ethers.toQuantity(maxFeePerGas) as `0x${string}`,
//           maxPriorityFeePerGas: ethers.toQuantity(
//             maxPriorityFeePerGas
//           ) as `0x${string}`,
//           nonce: correctNonce
//         },
//         idempotencyKey: uuidv4() // unique key for this transaction
//       })
//       signedTransaction = res.signedTransaction
//       encoding = res.encoding
//     }
    
//     console.log("signedTransaction", signedTransaction)
//     const txResponse = await provider.broadcastTransaction(signedTransaction)
//     hash = txResponse.hash
//     console.log(hash)
//     // Wait for confirmation
//     const receipt = await txResponse.wait()
//     console.log(receipt)

//     return {
//       hash: txResponse.hash
//     }
//   } catch (error: any) {
//     console.error('Error executing transaction:', error.message)
//     if (hash) {
//       throw new TransactionError(
//         `Failed to execute transaction (hash: ${hash}): ${error.message}`,
//         hash
//       )
//     } else {
//       throw new TransactionError(
//         `Failed to execute transaction: ${error.message}`
//       )
//     }
//   }
// }

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
  chainId: number,
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
      },
      timeout: 30000 // Add timeout to prevent hanging connections
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
  chainId: number,
  sysAddresses?: string[],
  ytsAddresses?: string[],
  marketsAddresses?: string[]
): Promise<any> {
  try {
    console.log('===== GET PENDLE REDEEM REWARDS TRANSACTION =====');
    console.log('SY Addresses:', sysAddresses);
    console.log('YT Addresses:', ytsAddresses);
    console.log('Market Addresses:', marketsAddresses);
    console.log('Chain ID:', chainId);
    
    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      console.error('Error: No wallet address found');
      throw new Error('EVM wallet not found')
    }
    console.log('Wallet address:', evmWalletAddress);

    const RECEIVER = evmWalletAddress

    // Convert arrays to comma-separated strings if provided
    const sys = sysAddresses?.join(',')
    const yts = ytsAddresses?.join(',')
    const markets = marketsAddresses?.join(',')
    console.log('Processed parameters:');
    console.log('- SY:', sys || 'none');
    console.log('- YTs:', yts || 'none');
    console.log('- Markets:', markets || 'none');

    // Use redeem-interests-and-rewards API endpoint
    const url = `${BASE_URL}/sdk/${chainId}/redeem-interests-and-rewards`
    console.log('API URL:', url);

    const params: any = { receiver: RECEIVER }
    if (sys) params.sys = sys
    if (yts) params.yts = yts
    if (markets) params.markets = markets
    console.log('Request parameters:', params);

    const response = await axios.get(url, { params })
    console.log('Response status:', response.status);
    
    if (!response.data || !response.data.tx) {
      console.error('Error: No transaction data in response');
      throw new Error('No transaction data returned from API')
    }
    
    console.log('Transaction data received successfully');
    return response.data.tx
  } catch (error: any) {
    console.error('Error in getRedeemInterestsAndRewardsTransactionFromPendle:', error);
    if (error.response) {
      console.error('Response error details:', error.response.status, error.response.statusText);
      console.error('Response data:', error.response.data);
    }
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
 * @param ptAddress The PT token address (optional, but recommended for better approval handling)
 * @returns Promise with transaction status and hash
 */
export async function executeRedeemTransaction(
  ytAddress: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number,
  enableAggregator: boolean = true,
  isDemo: boolean = false,
  ptAddress?: string
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

    if (txData.tokenApprovals && txData.tokenApprovals.length > 0) {
      for (const approval of txData.tokenApprovals) {
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
    } else {
      try {
        // Use the provided PT token address if available
        if (ptAddress) {
          // Approve the PT token
          const approvalResult = await erc20Approval(
            ptAddress,
            txData.to,
            amountIn,
            evmWalletAddress,
            chainId,
            isDemo
          );
          
          if (approvalResult.status === 'fail') {
            return {
              status: 'fail',
              message: `ERC20 approval failed for PT token: ${approvalResult.message}`
            };
          }
        } else {
          // Find the corresponding PT token for the given YT token using market data
          const markets = await getPendleMarkets('all', chainId);
          
          const market = markets.find(m => m.yt.toLowerCase() === ytAddress.toLowerCase());
          
          if (!market) {
            return {
              status: 'fail',
              message: 'Could not find corresponding PT token for the YT token'
            };
          }
          
          const ptTokenAddress = market.pt;
          
          // Approve the PT token
          const approvalResult = await erc20Approval(
            ptTokenAddress,
            txData.to,
            amountIn,
            evmWalletAddress,
            chainId,
            isDemo
          );
          
          if (approvalResult.status === 'fail') {
            return {
              status: 'fail',
              message: `ERC20 approval failed for PT token: ${approvalResult.message}`
            };
          }
        }
      } catch (error: any) {
        return {
          status: 'fail', 
          message: `Error approving PT token: ${error.message}`
        };
      }
    }

    // Execute the transaction
    const result = await executeTransaction(
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
  chainId: number,
  sysAddresses?: string[],
  ytsAddresses?: string[],
  marketsAddresses?: string[],
  isDemo: boolean = false
): Promise<{ status: string; hash?: string; message?: string }> {
  try {
    console.log('===== EXECUTE PENDLE REDEEM REWARDS TRANSACTION =====');
    console.log('SY Addresses:', sysAddresses);
    console.log('YT Addresses:', ytsAddresses);
    console.log('Market Addresses:', marketsAddresses);
    console.log('Chain ID:', chainId);
    console.log('Is Demo:', isDemo);
    
    const evmWalletAddress = await getUserEvmWalletAddress()
    if (!evmWalletAddress) {
      console.error('Error: No wallet address found');
      return {
        status: 'fail',
        message: 'EVM wallet not found'
      }
    }
    console.log('Wallet address:', evmWalletAddress);

    // Get transaction data
    console.log('Getting transaction data...');
    const txData = await getRedeemInterestsAndRewardsTransactionFromPendle(
      chainId,
      sysAddresses,
      ytsAddresses,
      marketsAddresses
    )

    if (!txData) {
      console.error('Error: No transaction data returned');
      return {
        status: 'fail',
        message: 'Failed to prepare redeem interests and rewards transaction data'
      }
    }

    // Handle token approvals if needed
    if (txData.tokenApprovals && txData.tokenApprovals.length > 0) {
      console.log(`Processing ${txData.tokenApprovals.length} token approvals`);
      for (const approval of txData.tokenApprovals) {
        console.log(`Approving token ${approval.token} for amount ${approval.amount}`);
        const approvalResult = await erc20Approval(
          approval.token,
          txData.to,
          approval.amount,
          evmWalletAddress,
          chainId,
          isDemo
        )
        
        if (approvalResult.status === 'fail') {
          console.error('Approval failed:', approvalResult.message);
          return {
            status: 'fail',
            message: `ERC20 approval failed: ${approvalResult.message}`
          }
        }
        console.log('Approval successful');
      }
    } else {
      console.log('No token approvals needed');
    }

    // Execute the transaction
    console.log('Executing transaction...');
    const result = await executeTransaction(
      txData,
      chainId,
      { estimateGas: true },
      isDemo
    )
    console.log('Transaction execution result:', result);

    return {
      status: 'success',
      hash: result.hash
    }
  } catch (error: any) {
    console.error('Error in executeRedeemInterestsAndRewardsTransaction:', error);
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




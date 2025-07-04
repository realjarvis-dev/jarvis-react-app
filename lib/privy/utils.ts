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
  chainId: number
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
  chainId: number,
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
    txData = await executeTransaction(
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
      txData = await executeTransaction(
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
  chainId: number,
  isDemo: boolean
): Promise<{ status: string; hash?: string; message?: string }> {
  // default to use the TEST_RPC_URL in env
  // on localhost can put 127.0.0.1:8545 for local testing
  // TODO: on deployment have to remove the TEST_RPC_URL for multichain support
  const provider = new ethers.JsonRpcProvider(
    process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
  )
  console.log(process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl)
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
  const allowance = await tokenContract.allowance(userAddress, spenderAddress)
  console.log("allowance", allowance)

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
    const txData = await executeTransaction(
      {
        to: tokenAddress,
        from: userAddress,
        data: approvalData,
        value: BigInt(0)
      },
      chainId,
      {
        estimateGas: true,
      },
      isDemo
    )
    return { status: 'success', hash: txData.hash }
  } catch (error: any) {
    if (error instanceof TransactionError) {
      return { status: 'fail', message: error.message, hash: error.hash }
    }
    return { status: 'fail', message: (error as Error).message }
  }
}

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

  // Check if we're using Anvil fork (which has reliable gas estimation)
  // vs Tenderly (which had issues with gas estimation)
  const rpcUrl = process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
  const isAnvilFork = rpcUrl.includes('127.0.0.1') || rpcUrl.includes('anvil-fork')
  
  if (isDemo && !isAnvilFork) {
    // Only disable gas estimation for non-Anvil demo environments (e.g., Tenderly)
    estimateGas = false
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
    // Use higher gas limit for complex transactions when estimation is disabled
    const fallbackGasLimit = isDemo ? 3000000 : 1000000
    gasLimit =
      gasOptions?.gasLimit ?? (ethers.toQuantity(fallbackGasLimit) as `0x${string}`)
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
      estimateGas: boolean;
      gasLimit?: `0x${string}`;
      eip1559GasPriceFunction?: (chainId: number) => Promise<{
        maxPriceInMemPool: bigint;
        maxPriorityFeePerGas: bigint;
        maxFeePerGas: bigint;
      }>;
      legacyGasPriceFunction?: (chainId: number) => Promise<number>;
    },
    isDemo: boolean = false
  ) {
    
    // Sign the transaction
    const { signedTransaction, provider } = await signTransaction(txData, chainId, gasOptions, isDemo);
    
    // Broadcast the transaction
    return await broadcastTransaction(signedTransaction, provider);
  }

/**
 * Approve Pendle tokens for spending
 * 
 * @param tokenAddress Reference token address (PT, YT, SY, or underlying)
 * @param tokenType Type of the reference token ('pt' | 'yt' | 'sy' | 'underlying')
 * @param amountIn Amount to approve in wei
 * @param approveFor List of token types to approve (['pt', 'yt', 'sy', 'underlying'])
 * @param spenderAddress Address of the spender (e.g., router contract)
 * @param chainId Chain ID
 * @param isDemo Whether this is a demo transaction
 * @returns Promise with approval results
 */
export async function approvePendleTokens(
  tokenAddress: string,
  tokenType: 'pt' | 'yt' | 'sy' | 'underlying',
  amountIn: string,
  approveFor: ('pt' | 'yt' | 'sy' | 'underlying')[],
  spenderAddress: string,
  userAddress: string,
  chainId: number,
  isDemo: boolean = false
): Promise<{ success: boolean; message?: string }> {
  try {
    // Import getPendleMarkets dynamically to avoid circular imports
    const { getPendleMarkets } = await import('../pendle/api');
    
    // Get all markets
    const markets = await getPendleMarkets('all', chainId);
    
    // Find the market containing the reference token
    let foundMarket;
    for (const market of markets) {
      if (
        (tokenType === 'pt' && market.pt.toLowerCase() === tokenAddress.toLowerCase()) ||
        (tokenType === 'yt' && market.yt.toLowerCase() === tokenAddress.toLowerCase()) ||
        (tokenType === 'sy' && market.sy.toLowerCase() === tokenAddress.toLowerCase()) ||
        (tokenType === 'underlying' && market.underlyingAsset.toLowerCase() === tokenAddress.toLowerCase())
      ) {
        foundMarket = market;
        break;
      }
    }
    
    if (!foundMarket) {
      throw new Error(`Could not find market for ${tokenType} token: ${tokenAddress}`);
    }
    
    console.log(`Found market: ${foundMarket.name}`);
    
    // Get provider for reading contract state
    const provider = new ethers.JsonRpcProvider(
      process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
    );
    
    // ERC20 ABI for approve and allowance functions
    const ERC20_ABI = [
      'function approve(address spender, uint256 amount) external returns (bool)',
      'function allowance(address owner, address spender) external view returns (uint256)'
    ];
    
    const approvalResults: string[] = [];
    
    // Check and approve each requested token type
    for (const approveType of approveFor) {
      let tokenToApprove: string;
      
      switch (approveType) {
        case 'pt':
          tokenToApprove = foundMarket.pt;
          break;
        case 'yt':
          tokenToApprove = foundMarket.yt;
          break;
        case 'sy':
          tokenToApprove = foundMarket.sy;
          break;
        case 'underlying':
          tokenToApprove = foundMarket.underlyingAsset;
          break;
        default:
          continue;
      }
      
      console.log(`Checking allowance for ${approveType.toUpperCase()} token: ${tokenToApprove}`);
      
      const tokenContract = new ethers.Contract(tokenToApprove, ERC20_ABI, provider);
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
      const requiredAmount = BigInt(amountIn);
      
      console.log(`Current allowance: ${currentAllowance.toString()}, Required: ${requiredAmount.toString()}`);
      
      // Only approve if current allowance is insufficient
      if (currentAllowance < requiredAmount) {
        console.log(`Approving ${approveType.toUpperCase()} token: ${tokenToApprove}`);
        
        // Encode the approve function call
        const approveData = tokenContract.interface.encodeFunctionData('approve', [
          spenderAddress,
          amountIn
        ]);
        
        // Prepare transaction data
        const txData = {
          to: tokenToApprove,
          from: userAddress,
          data: approveData,
          value: '0'
        };
        
        // Execute the approval transaction
        const result = await executeTransaction(
          txData,
          chainId,
          {
            estimateGas: true
          },
          isDemo
        );
        
        console.log(`${approveType.toUpperCase()} token approval successful: ${result.hash}`);
        approvalResults.push(`${approveType.toUpperCase()} approved: ${result.hash}`);
      } else {
        console.log(`${approveType.toUpperCase()} token already has sufficient allowance`);
        approvalResults.push(`${approveType.toUpperCase()} already approved (sufficient allowance)`);
      }
    }
    
    return {
      success: true,
      message: `Token approval check completed: ${approvalResults.join(', ')}`
    };
    
  } catch (error: any) {
    console.error('Pendle token approval failed:', error);
    return {
      success: false,
      message: `Pendle token approval failed: ${error.message}`
    };
  }
}

/**
 * Approve Pendle tokens using brute force market search
 * Searches through all markets to find the input token and approves it
 * 
 * @param tokenAddress Input token address to approve
 * @param amountIn Amount to approve in wei
 * @param spenderAddress Address of the spender (e.g., router contract)
 * @param userAddress User's wallet address
 * @param chainId Chain ID
 * @param isDemo Whether this is a demo transaction
 * @returns Promise with approval results
 */
export async function approvePendleTokensBruteForce(
  tokenAddress: string,
  amountIn: string,
  spenderAddress: string,
  userAddress: string,
  chainId: number,
  isDemo: boolean = false
): Promise<{ success: boolean; message?: string }> {
  try {
    // Import getPendleMarkets dynamically to avoid circular imports
    const { getPendleMarkets } = await import('../pendle/api');
    
    // Get all markets
    const markets = await getPendleMarkets('all', chainId);
    
    // Search through all markets to find the token
    let foundToken = false;
    let tokenType: string = '';
    
    for (const market of markets) {
      if (market.pt.toLowerCase() === tokenAddress.toLowerCase()) {
        foundToken = true;
        tokenType = 'PT';
        break;
      } else if (market.yt.toLowerCase() === tokenAddress.toLowerCase()) {
        foundToken = true;
        tokenType = 'YT';
        break;
      } else if (market.sy.toLowerCase() === tokenAddress.toLowerCase()) {
        foundToken = true;
        tokenType = 'SY';
        break;
      } else if (market.underlyingAsset.toLowerCase() === tokenAddress.toLowerCase()) {
        foundToken = true;
        tokenType = 'Underlying';
        break;
      }
    }
    
    if (!foundToken) {
      throw new Error(`Token ${tokenAddress} not found in any Pendle market`);
    }
    
    console.log(`Found ${tokenType} token: ${tokenAddress}`);
    
    // Get provider for reading contract state
    const provider = new ethers.JsonRpcProvider(
      process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
    );
    
    // ERC20 ABI for approve and allowance functions
    const ERC20_ABI = [
      'function approve(address spender, uint256 amount) external returns (bool)',
      'function allowance(address owner, address spender) external view returns (uint256)'
    ];
    
    console.log(`Checking allowance for ${tokenType} token: ${tokenAddress}`);
    
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    // Check current allowance
    const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);
    const requiredAmount = BigInt(amountIn);
    
    console.log(`Current allowance: ${currentAllowance.toString()}, Required: ${requiredAmount.toString()}`);
    
    // Only approve if current allowance is insufficient
    if (currentAllowance < requiredAmount) {
      console.log(`Approving ${tokenType} token: ${tokenAddress}`);
      
      // Encode the approve function call
      const approveData = tokenContract.interface.encodeFunctionData('approve', [
        spenderAddress,
        amountIn
      ]);
      
      // Prepare transaction data
      const txData = {
        to: tokenAddress,
        from: userAddress,
        data: approveData,
        value: '0'
      };
      
      // Execute the approval transaction
      const result = await executeTransaction(
        txData,
        chainId,
        {
          estimateGas: true
        },
        isDemo
      );
      
      console.log(`${tokenType} token approval successful: ${result.hash}`);
      
      return {
        success: true,
        message: `${tokenType} token approved: ${result.hash}`
      };
    } else {
      console.log(`${tokenType} token already has sufficient allowance`);
      
      return {
        success: true,
        message: `${tokenType} token already approved (sufficient allowance)`
      };
    }
    
  } catch (error: any) {
    console.error('Pendle token approval failed:', error);
    return {
      success: false,
      message: `Pendle token approval failed: ${error.message}`
    };
  }
}

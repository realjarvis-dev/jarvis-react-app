import { getUserEvmWalletAddress, getUserWallet, privy } from "@/lib/privy/client";
import { ethers } from "ethers";
import { v4 as uuidv4 } from 'uuid';
import { getGasPriceByChainId } from "../blocknative/get-gas-price";
import { getConfigByChainId } from "../network/config";

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
    txData: {
      to: string;
      from: string;
      data: string;
      value?: string | bigint;
    },
    chainId: number,
    gasOptions?: {
      estimateGas: boolean;
      gasLimit?: `0x${string}`;
      getGasPriceFunction?: (chainId: number) => Promise<{
        maxPriceInMemPool: bigint;
        maxPriorityFeePerGas: bigint;
        maxFeePerGas: bigint;
      }>;
    },
    isDemo: boolean = false
  ) {
    
    // Get EVM wallet and user address
    const evmWallet = await getUserWallet('ethereum');
    if (!evmWallet || !evmWallet.id) {
      throw new Error('EVM wallet not found');
    }
  
    const userAddress = await getUserEvmWalletAddress();
    if (!userAddress) {
      throw new Error('User address not found');
    }

    // Get provider for gas estimation
    const provider = new ethers.JsonRpcProvider(
      process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
    );

    // Get latest block for base fee calculation
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas;
    const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044); // ~2× base fee
    const priority = ethers.parseUnits('1', 'gwei'); // 1 gwei tip
    let maxFeePerGas = maxFee + priority;
    let maxPriorityFeePerGas = priority;

    // Use blocknative API for gas pricing if available
    if (gasOptions?.getGasPriceFunction) {
      const estimateGasPrice = await gasOptions.getGasPriceFunction(chainId);
      maxFeePerGas = estimateGasPrice.maxFeePerGas;
      maxPriorityFeePerGas = estimateGasPrice.maxPriorityFeePerGas;
    } else {
      // Try to use blocknative by default
      try {
        const gasPriceData = await getGasPriceByChainId(chainId);
        maxFeePerGas = gasPriceData.maxFeePerGas;
        maxPriorityFeePerGas = gasPriceData.maxPriorityFeePerGas;
      } catch (error) {
        console.warn('Failed to get gas price from Blocknative, using fallback:', error);
        // Fallback values already set above
      }
    }

    // Get current nonce
    const nonce = await provider.getTransactionCount(userAddress as `0x${string}`, 'pending');

    // Handle gas limit estimation
    let gasLimit: `0x${string}`;
    let estimateGas = gasOptions?.estimateGas !== false; // Default to true if not specified
    
    if (isDemo) {
      estimateGas = false;
    }

    if (estimateGas) {
      // Gas estimation with buffer
      const gasEstimate = await provider.estimateGas({
        to: txData.to,
        from: txData.from,
        data: txData.data,
        value: txData.value || BigInt(0)
      });
      // Add 20% buffer to gas estimate
      gasLimit = ethers.toQuantity(gasEstimate + gasEstimate / BigInt(5)) as `0x${string}`;
    } else {
      gasLimit = gasOptions?.gasLimit ?? (ethers.toQuantity(1000000) as `0x${string}`);
    }

    // Convert value to hex quantity
    const weiBig = BigInt(txData.value || '0');
    const quantity = ethers.toQuantity(weiBig);

    // Sign transaction with Privy
    const { signedTransaction } = await privy.walletApi.ethereum.signTransaction({
      walletId: evmWallet.id,
      transaction: {
        to: txData.to as `0x${string}`,
        from: txData.from as `0x${string}`,
        chainId: chainId,
        value: quantity as `0x${string}`,
        data: txData.data as `0x${string}`,
        gasLimit: gasLimit,
        maxFeePerGas: ethers.toQuantity(maxFeePerGas) as `0x${string}`,
        maxPriorityFeePerGas: ethers.toQuantity(maxPriorityFeePerGas) as `0x${string}`,
        nonce: nonce
      },
      idempotencyKey: uuidv4()
    });

    return {
      signedTransaction,
      provider
    };
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
    // Broadcast the transaction
    const txResponse = await provider.broadcastTransaction(signedTransaction);
    
    // Wait for confirmation
    const receipt = await txResponse.wait();
    
    return {
      hash: txResponse.hash
    };
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
    txData: {
      to: string;
      from: string;
      data: string;
      value?: string | bigint;
    },
    chainId: number,
    gasOptions?: {
      estimateGas: boolean;
      gasLimit?: `0x${string}`;
      getGasPriceFunction?: (chainId: number) => Promise<{
        maxPriceInMemPool: bigint;
        maxPriorityFeePerGas: bigint;
        maxFeePerGas: bigint;
      }>;
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
    const markets = await getPendleMarkets('all');
    
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
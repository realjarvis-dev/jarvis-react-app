import { getUserEvmWalletAddress, getUserWallet, privy } from "@/lib/privy/client";
import { ethers } from "ethers";
import { v4 as uuidv4 } from 'uuid';
import { getGasPriceByChainId } from "../blocknative/get-gas-price";
import { getConfigByChainId } from "../network/config";

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
 * @param chainId Chain ID (default: 1)
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
    chainId: number = 1,
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

    // Sign and send transaction with Privy
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

    // Broadcast the transaction
    const txResponse = await provider.broadcastTransaction(signedTransaction);
    
    // Wait for confirmation
    const receipt = await txResponse.wait();
    
    return {
      hash: txResponse.hash
    };
  }
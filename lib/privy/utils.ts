import { privy } from "@/lib/privy/client";
import { ethers } from "ethers";
import { v4 as uuidv4 } from 'uuid';
import { getConfigByChainId } from "../network/config";

/**
 * Execute swap transaction using Privy wallet
 * @param swapResult Result from swapTokens function
 * @param chainId Chain ID (default: 1)
 * @param isDemo Whether this is a demo transaction
 * @returns Transaction response with hash
 */
export async function executeSwap(
    swapResult: any,
    chainId: number,
    isDemo: boolean = false,
    userAddress: string,
    evmWalletId: string
  ) {
  
    // Get provider for gas estimation
    const provider = new ethers.JsonRpcProvider(
      process.env.TEST_RPC_URL || getConfigByChainId(chainId, isDemo).rpcUrl
    );
  
    // Basic gas estimation
    const gasEstimate = await provider.estimateGas({
      to: swapResult.tx.to,
      from: userAddress,
      data: swapResult.tx.data,
      value: swapResult.tx.value || '0x0'
    });
  
    // Add 20% buffer to gas estimate
    const gasLimit = ethers.toQuantity(gasEstimate + gasEstimate / BigInt(5)) as `0x${string}`;
  
    // Get current nonce
    const nonce = await provider.getTransactionCount(userAddress as `0x${string}`, 'pending');
  
    // Get gas pricing
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas || BigInt(20000000000); // 20 gwei fallback
    const maxFeePerGas = baseFee * BigInt(2);
    const maxPriorityFeePerGas = ethers.parseUnits('1', 'gwei'); // 1 gwei tip
  
    // Sign and send transaction with Privy
    const { signedTransaction } = await privy.walletApi.ethereum.signTransaction({
      walletId: evmWalletId,
      transaction: {
        to: swapResult.tx.to as `0x${string}`,
        from: userAddress as `0x${string}`,
        chainId: chainId,
        value: (swapResult.tx.value || '0x0') as `0x${string}`,
        data: swapResult.tx.data as `0x${string}`,
        gasLimit: gasLimit,
        maxFeePerGas: ethers.toQuantity(maxFeePerGas) as `0x${string}`,
        maxPriorityFeePerGas: ethers.toQuantity(maxPriorityFeePerGas) as `0x${string}`,
        nonce: nonce
      },
      idempotencyKey: uuidv4()
    });
    
    return signedTransaction;
  }
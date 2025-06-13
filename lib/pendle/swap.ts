import { getUserEvmWalletAddress } from '@/lib/privy/client';
import { executeTransaction } from '@/lib/privy/utils';
import { callSDK } from './call-sdk';
import { SwapData } from './types';

// Chain ID for Ethereum mainnet
const CHAIN_ID = 1;

/**
 * Get Pendle swap data using Pendle SDK (simplified approach with Privy)
 * @param marketAddress The Pendle market address
 * @param tokenIn Address of the input token
 * @param tokenOut Address of the output token  
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param enableAggregator Whether to enable swap aggregator for complex routes
 * @param chainId Chain ID (default: 1)
 * @returns Promise with swap data and transaction
 */
export async function getPendleSwapTokensData(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true,
  chainId: number = CHAIN_ID
) {
  const receiverAddress = await getUserEvmWalletAddress();
  if (!receiverAddress) {
    throw new Error('EVM wallet not found');
  }

  const res = await callSDK<SwapData>(`/v1/sdk/${chainId}/markets/${marketAddress}/swap`, {
    receiver: receiverAddress,
    slippage,
    tokenIn,
    tokenOut,
    amountIn,
    enableAggregator
  });

  console.log('Amount Out:', res.data.amountOut);
  console.log('Price Impact:', res.data.priceImpact);

  return res;
}

/**
 * Execute Pendle swap transaction using Privy wallet
 * @param marketAddress The Pendle market address
 * @param tokenIn Address of the input token
 * @param tokenOut Address of the output token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param enableAggregator Whether to enable swap aggregator for complex routes
 * @param chainId Chain ID
 * @param isDemo Whether this is a demo transaction
 * @returns Transaction response with hash
 */
export async function executePendleSwap(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true,
  chainId: number = CHAIN_ID,
  isDemo: boolean = false
) {
  // Get swap data
  const swapResult = await getPendleSwapTokensData(
    marketAddress,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    enableAggregator,
    chainId
  );

  // Get user address
  const userAddress = await getUserEvmWalletAddress();
  if (!userAddress) {
    throw new Error('User address not found');
  }

  // Prepare transaction data
  const txData = {
    to: swapResult.tx.to,
    from: userAddress,
    data: swapResult.tx.data,
    value: swapResult.tx.value || '0'
  };

  // Execute transaction using the utility function
  const txResponse = await executeTransaction(
    txData,
    chainId,
    {
      estimateGas: true
    },
    isDemo
  );

  console.log('Transaction hash:', txResponse.hash);
  
  return txResponse;
}

/**
 * Get quote only (without executing transaction)
 * @param marketAddress The Pendle market address
 * @param tokenIn Address of the input token
 * @param tokenOut Address of the output token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param enableAggregator Whether to enable swap aggregator
 * @returns Promise with swap data only
 */
export async function getSwapQuote(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true
) {
  const swapResult = await getPendleSwapTokensData(
    marketAddress,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    enableAggregator
  );

  return swapResult.data; // Return only the swap data, not the transaction
}

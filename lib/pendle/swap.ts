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
 * @param userWalletAddress User's wallet address
 * @returns Promise with swap data and transaction
 */
export async function getPendleSwapTokensData(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true,
  chainId: number = CHAIN_ID,
  userWalletAddress: string
) {

  const res = await callSDK<SwapData>(`/v1/sdk/${chainId}/markets/${marketAddress}/swap`, {
    receiver: userWalletAddress,
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
 * @param userWalletAddress User's wallet address
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
  isDemo: boolean = false,
  userWalletAddress: string
) {
  // Get swap data
  const swapResult = await getPendleSwapTokensData(
    marketAddress,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    enableAggregator,
    chainId,
    userWalletAddress
  );

  // Prepare transaction data
  const txData = {
    to: swapResult.tx.to,
    from: userWalletAddress,
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
 * @param chainId Chain ID
 * @param userWalletAddress User's wallet address
 * @returns Promise with swap data only
 */
export async function getSwapQuote(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true,
  chainId: number = CHAIN_ID,
  userWalletAddress: string
) {
  
  const swapResult = await getPendleSwapTokensData(
    marketAddress,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    enableAggregator,
    chainId,
    userWalletAddress
  );

  return swapResult.data; // Return only the swap data, not the transaction
}

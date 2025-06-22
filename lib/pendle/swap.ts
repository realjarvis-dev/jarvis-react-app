import { approvePendleTokens, executeTransaction } from '@/lib/privy/utils';
import { callSDK } from './call-sdk';
import { SwapData } from './types';

// Native ETH is represented by the zero address in the Pendle API
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

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
  chainId: number,
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
 * @param tokenType Type of the input token ('pt' or 'yt')
 * @returns Transaction response with hash
 */
export async function executePendleSwap(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true,
  chainId: number,
  isDemo: boolean = false,
  userWalletAddress: string,
  tokenType: 'pt' | 'yt' = 'pt'
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

  // Check if input token is not ETH and requires approval
  const isInputTokenETH = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
  
  if (!isInputTokenETH) {
    console.log('Input token is ERC20, checking approval requirements');
    
    const approvalResult = await approvePendleTokens(
      tokenIn,              // Token address to approve
      tokenType,            // Token type ('pt' or 'yt')
      amountIn,             // Amount to approve
      [tokenType],          // Approve only the input token type
      swapResult.tx.to,     // Spender address (Pendle router)
      userWalletAddress,    // User address
      chainId,              // Chain ID
      isDemo                // Demo flag
    );
    
    if (!approvalResult.success) {
      throw new Error(`Token approval failed: ${approvalResult.message}`);
    }
    console.log('Token approval completed successfully');
  } else {
    console.log('Input token is ETH, no approval required');
  }

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
  chainId: number,
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

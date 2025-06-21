import { approvePendleTokens, executeTransaction } from '@/lib/privy/utils';
import { callSDK } from './call-sdk';
import { RedeemPyData } from './types';



/**
 * Get Pendle redeem PY data using Pendle SDK (simplified approach with Privy)
 * @param ytAddress YT token address
 * @param amountIn Amount of PT and YT to redeem in wei (should be equal amounts)
 * @param tokenOut Address of the output token (SY or underlying token)
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID (default: 1)
 * @param userWalletAddress User's wallet address
 * @returns Promise with redeem data and transaction
 */
export async function getPendleRedeemPyData(
  ytAddress: string,
  amountIn: string,
  tokenOut: string,
  slippage: number = 0.01,
  chainId: number = 1,
  userWalletAddress: string
) {
  const res = await callSDK<RedeemPyData>(`/v1/sdk/${chainId}/redeem`, {
    receiver: userWalletAddress,
    slippage,
    yt: ytAddress,
    amountIn,
    tokenOut,
  });

  console.log('Amount Out:', res.data.amountOut);
  console.log('Price Impact:', res.data.priceImpact);

  return res;
}

/**
 * Execute Pendle redeem PY transaction using Privy wallet
 * @param ytAddress YT token address
 * @param amountIn Amount of PT and YT to redeem in wei (should be equal amounts)
 * @param tokenOut Address of the output token (SY or underlying token)
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param isDemo Whether this is a demo transaction
 * @param userWalletAddress User's wallet address
 * @returns Transaction response with hash
 */
export async function executePendleRedeemPy(
  ytAddress: string,
  amountIn: string,
  tokenOut: string,
  slippage: number = 0.01,
  chainId: number = 1,
  isDemo: boolean = false,
  userWalletAddress: string
) {
  // Get redeem data
  const redeemResult = await getPendleRedeemPyData(
    ytAddress,
    amountIn,
    tokenOut,
    slippage,
    chainId,
    userWalletAddress
  );

  // Approve PT and YT tokens using the new utility function
  console.log('Approving PT and YT tokens for redeem operation');
  
  const approvalResult = await approvePendleTokens(
    ytAddress,           // Reference token address (YT)
    'yt',               // Token type
    amountIn,           // Amount to approve
    ['pt', 'yt'],       // Approve both PT and YT tokens
    redeemResult.tx.to, // Spender address (Pendle router)
    userWalletAddress,
    chainId,
    isDemo
  );
  
  if (!approvalResult.success) {
    throw new Error(`Token approval failed: ${approvalResult.message}`);
  }
  console.log('Token approvals completed successfully');

  // Prepare transaction data
  const txData = {
    to: redeemResult.tx.to,
    from: userWalletAddress,
    data: redeemResult.tx.data,
    value: redeemResult.tx.value || '0'
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
 * Get redeem quote only (without executing transaction)
 * @param ytAddress YT token address
 * @param amountIn Amount of PT and YT to redeem in wei (should be equal amounts)
 * @param tokenOut Address of the output token (SY or underlying token)
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param userWalletAddress User's wallet address
 * @returns Promise with redeem data only
 */
export async function getRedeemPyQuote(
  ytAddress: string,
  amountIn: string,
  tokenOut: string,
  slippage: number = 0.01,
  chainId: number = 1,
  userWalletAddress: string
) {
  const redeemResult = await getPendleRedeemPyData(
    ytAddress,
    amountIn,
    tokenOut,
    slippage,
    chainId,
    userWalletAddress
  );

  return redeemResult.data; // Return only the redeem data, not the transaction
}

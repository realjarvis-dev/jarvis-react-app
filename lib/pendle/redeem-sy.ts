import { approvePendleTokens, executeTransaction } from '@/lib/privy/utils';
import { callSDK } from './call-sdk';
import { RedeemSyData } from './types';

// Chain ID for Ethereum mainnet
const CHAIN_ID = 1;

/**
 * Get Pendle redeem SY data using Pendle SDK
 * @param syAddress The SY (Standardized Yield) address
 * @param amountIn Amount of SY token to redeem in wei
 * @param tokenOut Address of the output token
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID (default: 1)
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Promise with redeem data and transaction
 */
export async function getPendleRedeemSyData(
  syAddress: string,
  amountIn: string,
  tokenOut: string,
  slippage: number = 0.01,
  chainId: number = CHAIN_ID,
  userWalletAddress: string
) {
  const res = await callSDK<RedeemSyData>(`/v1/sdk/${chainId}/redeem-sy`, {
    receiver: userWalletAddress,
    slippage,
    sy: syAddress,
    amountIn,
    tokenOut,
  });

  console.log('Amount Out:', res.data.amountOut);
  console.log('Price Impact:', res.data.priceImpact);

  return res;
}

/**
 * Execute Pendle redeem SY transaction using Privy wallet
 * Redeems SY (Standardized Yield) tokens to output token
 * @param syAddress The SY (Standardized Yield) address
 * @param amountIn Amount of SY token to redeem in wei
 * @param tokenOut Address of the output token
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param isDemo Whether this is a demo transaction
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Transaction response with hash
 */
export async function executePendleRedeemSy(
  syAddress: string,
  amountIn: string,
  tokenOut: string,
  slippage: number = 0.01,
  chainId: number = CHAIN_ID,
  isDemo: boolean = false,
  userWalletAddress: string
) {
  // Get redeem data
  const redeemResult = await getPendleRedeemSyData(
    syAddress,
    amountIn,
    tokenOut,
    slippage,
    chainId,
    userWalletAddress
  );

  // Approve SY token
  console.log('Approving SY token for redeem operation');
  
  const approvalResult = await approvePendleTokens(
    syAddress,           // Reference token address (SY token)
    'sy',               // Token type
    amountIn,           // Amount to approve
    ['underlying'],             // Approve the underlying token
    redeemResult.tx.to, // Spender address (Pendle router)
    userWalletAddress,
    chainId,
    isDemo
  );
  
  if (!approvalResult.success) {
    throw new Error(`Token approval failed: ${approvalResult.message}`);
  }
  console.log('SY token approval completed successfully');

  // Prepare transaction data
  const txData = {
    to: redeemResult.tx.to,
    from: userWalletAddress,
    data: redeemResult.tx.data,
    value: redeemResult.tx.value || '0'
  };

  // Execute transaction
  const txResponse = await executeTransaction(
    txData,
    chainId,
    {
      estimateGas: true
    },
    isDemo
  );

  console.log('Redeem SY transaction hash:', txResponse.hash);
  
  return txResponse;
}

/**
 * Get redeem SY quote only (without executing transaction)
 * @param syAddress The SY (Standardized Yield) address
 * @param amountIn Amount of SY token to redeem in wei
 * @param tokenOut Address of the output token
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Promise with redeem data only
 */
export async function getRedeemSyQuote(
  syAddress: string,
  amountIn: string,
  tokenOut: string,
  slippage: number = 0.01,
  chainId: number = CHAIN_ID,
  userWalletAddress: string
) {
  const redeemResult = await getPendleRedeemSyData(
    syAddress,
    amountIn,
    tokenOut,
    slippage,
    chainId,
    userWalletAddress
  );

  return redeemResult.data; // Return only the redeem data, not the transaction
}

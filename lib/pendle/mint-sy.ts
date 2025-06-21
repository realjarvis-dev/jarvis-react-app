import { approvePendleTokens, executeTransaction } from '@/lib/privy/utils';
import { callSDK } from './call-sdk';
import { MintSyData } from './types';



/**
 * Get Pendle mint SY data using Pendle SDK
 * @param syAddress The SY (Standardized Yield) address
 * @param tokenIn Address of the input token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID (default: 1)
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Promise with mint data and transaction
 */
export async function getPendleMintSyData(
  syAddress: string,
  tokenIn: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number,
  userWalletAddress: string
) {
  const res = await callSDK<MintSyData>(`/v1/sdk/${chainId}/mint-sy`, {
    receiver: userWalletAddress,
    sy: syAddress,
    slippage,
    tokenIn,
    amountIn,
  });

  console.log('Amount SY Out:', res.data.amountOut);
  console.log('Price Impact:', res.data.priceImpact);

  return res;
}

/**
 * Execute Pendle mint SY transaction using Privy wallet
 * Mints SY (Standardized Yield) tokens from input token
 * @param syAddress The SY (Standardized Yield) address
 * @param tokenIn Address of the input token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param isDemo Whether this is a demo transaction
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Transaction response with hash
 */
export async function executePendleMintSy(
  syAddress: string,
  tokenIn: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number,
  isDemo: boolean = false,
  userWalletAddress: string
) {
  // Get mint data
  const mintResult = await getPendleMintSyData(
    syAddress,
    tokenIn,
    amountIn,
    slippage,
    chainId,
    userWalletAddress
  );

  // Approve input token
  console.log('Approving input token for mint SY operation');
  
  const approvalResult = await approvePendleTokens(
    syAddress,              // Reference token address (input token)
    'sy',         // Token type
    amountIn,             // Amount to approve
    ['underlying'],       // Approve the input token
    mintResult.tx.to,     // Spender address (Pendle router)
    userWalletAddress,
    chainId,
    isDemo
  );
  
  if (!approvalResult.success) {
    throw new Error(`Token approval failed: ${approvalResult.message}`);
  }
  console.log('Input token approval completed successfully');

  // Prepare transaction data
  const txData = {
    to: mintResult.tx.to,
    from: userWalletAddress,
    data: mintResult.tx.data,
    value: mintResult.tx.value || '0'
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

  console.log('Mint SY transaction hash:', txResponse.hash);
  
  return txResponse;
}

/**
 * Get mint SY quote only (without executing transaction)
 * @param syAddress The SY (Standardized Yield) address
 * @param tokenIn Address of the input token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Promise with mint data only
 */
export async function getMintSyQuote(
  syAddress: string,
  tokenIn: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number,
  userWalletAddress: string
) {
  const mintResult = await getPendleMintSyData(
    syAddress,
    tokenIn,
    amountIn,
    slippage,
    chainId,
    userWalletAddress
  );

  return mintResult.data; // Return only the mint data, not the transaction
}

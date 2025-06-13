import { executeTransaction } from '@/lib/privy/utils';
import { callSDK } from './call-sdk';
import { MintPyData } from './types';

// Chain ID for Ethereum mainnet
const CHAIN_ID = 1;

/**
 * Get Pendle mint PY data using Pendle SDK (simplified approach with Privy)
 * @param ytAddress The YT (Yield Token) address
 * @param tokenIn Address of the input token (can be SY or underlying token)
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID (default: 1)
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Promise with mint data and transaction
 */
export async function getPendleMintPyData(
  ytAddress: string,
  tokenIn: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number = CHAIN_ID,
  userWalletAddress: string
) {
  const res = await callSDK<MintPyData>(`/v1/sdk/${chainId}/mint`, {
    receiver: userWalletAddress,
    yt: ytAddress,
    slippage,
    tokenIn,
    amountIn,
  });

  console.log('Amount PT & YT Out:', res.data.amountOut);
  console.log('Price Impact:', res.data.priceImpact);

  return res;
}

/**
 * Execute Pendle mint PY transaction using Privy wallet
 * Mints both PT (Principal Token) and YT (Yield Token) from input token
 * @param ytAddress The YT (Yield Token) address
 * @param tokenIn Address of the input token (can be SY or underlying token)
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param isDemo Whether this is a demo transaction
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Transaction response with hash
 */
export async function executePendleMintPy(
  ytAddress: string,
  tokenIn: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number = CHAIN_ID,
  isDemo: boolean = false,
  userWalletAddress: string
) {
  // Get mint data
  const mintResult = await getPendleMintPyData(
    ytAddress,
    tokenIn,
    amountIn,
    slippage,
    chainId,
    userWalletAddress
  );

  // Prepare transaction data
  const txData = {
    to: mintResult.tx.to,
    from: userWalletAddress,
    data: mintResult.tx.data,
    value: mintResult.tx.value || '0'
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

  console.log('Mint PY transaction hash:', txResponse.hash);
  
  return txResponse;
}

/**
 * Get mint quote only (without executing transaction)
 * @param ytAddress The YT (Yield Token) address
 * @param tokenIn Address of the input token (can be SY or underlying token)
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param chainId Chain ID
 * @param userWalletAddress User's wallet address (receiver)
 * @returns Promise with mint data only
 */
export async function getMintPyQuote(
  ytAddress: string,
  tokenIn: string,
  amountIn: string,
  slippage: number = 0.01,
  chainId: number = CHAIN_ID,
  userWalletAddress: string
) {
  const mintResult = await getPendleMintPyData(
    ytAddress,
    tokenIn,
    amountIn,
    slippage,
    chainId,
    userWalletAddress
  );

  return mintResult.data; // Return only the mint data, not the transaction
}

import { executeTransaction } from '@/lib/privy/utils';
import { getPendleMarkets } from './api';
import { callSDK } from './call-sdk';
import { erc20Approval } from './transactions';
import { RedeemPyData } from './types';

// Chain ID for Ethereum mainnet
const CHAIN_ID = 1;

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
  chainId: number = CHAIN_ID,
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
  chainId: number = CHAIN_ID,
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

  // Handle token approvals - we need to approve both PT and YT tokens
  // The callSDK response doesn't include tokenApprovals, so we manually approve PT and YT tokens
  console.log('Manually approving PT and YT tokens for redeem operation');
  
  // Find the corresponding PT token for the given YT token using market data
  const markets = await getPendleMarkets('all');
  const market = markets.find(m => m.yt.toLowerCase() === ytAddress.toLowerCase());
  
  if (!market) {
    throw new Error('Could not find corresponding PT token for the YT token');
  }
  
  const ptTokenAddress = market.pt;
  console.log(`Found PT token: ${ptTokenAddress} for YT token: ${ytAddress}`);
  
  // Approve both PT and YT tokens
  const ptApprovalResult = await erc20Approval(
    ptTokenAddress,
    redeemResult.tx.to,
    amountIn,
    userWalletAddress,
    chainId,
    isDemo
  );
  
  if (ptApprovalResult.status === 'fail') {
    throw new Error(`ERC20 approval failed for PT token: ${ptApprovalResult.message}`);
  }
  console.log('PT token approval successful');
  
  const ytApprovalResult = await erc20Approval(
    ytAddress,
    redeemResult.tx.to,
    amountIn,
    userWalletAddress,
    chainId,
    isDemo
  );
  
  if (ytApprovalResult.status === 'fail') {
    throw new Error(`ERC20 approval failed for YT token: ${ytApprovalResult.message}`);
  }
  console.log('YT token approval successful');

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
  chainId: number = CHAIN_ID,
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
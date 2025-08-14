import { approvePendleTokens, executeTransaction } from '@/lib/privy/utils';
import { ethers } from 'ethers';
import { callSDK } from './call-sdk';
import { SwapData } from './types';


// Native ETH is represented by the zero address in the Pendle API
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Categorize price impact level for user warnings
 * @param priceImpact Price impact percentage (e.g., 5.5 for 5.5%)
 * @returns Price impact level category
 */
function getPriceImpactLevel(priceImpact: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (priceImpact <= 1) return 'low';
  if (priceImpact <= 5) return 'medium';
  if (priceImpact <= 15) return 'high';
  return 'extreme';
}

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
  console.log('Price Impact (raw):', res.data.priceImpact);

  // Validate transaction data
  if (!res.tx.data || res.tx.data === '0x' || res.tx.data === '') {
    throw new Error('Invalid transaction data returned from Pendle API. This may indicate insufficient liquidity or an unsupported swap pair.');
  }

  // Normalize price impact - Pendle API might return it in different formats
  let normalizedPriceImpact = res.data.priceImpact;
  
  console.log('Raw price impact from API:', normalizedPriceImpact);
  
  // Check if the price impact is in basis points (common for DeFi APIs)
  // Basis points: 1% = 100 basis points, so divide by 10,000 to get percentage
  if (normalizedPriceImpact > 100) {
    console.warn(`High price impact value detected: ${normalizedPriceImpact}. Checking if this is in basis points.`);
    
    // Try interpreting as basis points (divide by 10,000 for percentage)
    const basisPointsInterpretation = normalizedPriceImpact / 10000;
    console.log(`Basis points interpretation: ${basisPointsInterpretation}%`);
    
    // If the basis points interpretation gives a reasonable result (< 50%), use it
    if (basisPointsInterpretation < 50) {
      normalizedPriceImpact = basisPointsInterpretation;
      console.log(`Using basis points interpretation: ${normalizedPriceImpact}%`);
    } else {
      // If still very high, try dividing by 100 (some APIs use this format)
      const percentageInterpretation = normalizedPriceImpact / 100;
      console.log(`Percentage interpretation (÷100): ${percentageInterpretation}%`);
      
      if (percentageInterpretation < 50) {
        normalizedPriceImpact = percentageInterpretation;
        console.log(`Using percentage interpretation: ${normalizedPriceImpact}%`);
      } else {
        // If still unreasonably high, log warning but don't cap arbitrarily
        console.warn(`Price impact still very high: ${normalizedPriceImpact}%. This might indicate insufficient liquidity or a calculation error.`);
        
        // Check trade size to provide context
        const amountInWei = BigInt(amountIn);
        const amountInEth = parseFloat(ethers.formatEther(amountInWei));
        console.log(`Trade amount: ${amountInEth} ETH equivalent`);
        
        if (amountInEth < 0.001) {
          console.warn('Very small trade amount detected. Price impact calculations may be unreliable for micro-trades.');
        }
        
        // Don't cap the price impact - let the user see the real impact
        // The tool layer will handle confirmation for high impact trades
      }
    }
  }
  
  console.log('Price Impact (normalized):', normalizedPriceImpact + '%');
  
  // Update the response with normalized price impact
  res.data.priceImpact = normalizedPriceImpact;

  // Return data with price impact warnings instead of throwing errors
  // Let the tools handle the confirmation flow
  const priceImpactLevel = getPriceImpactLevel(normalizedPriceImpact);
  
  if (priceImpactLevel === 'extreme') {
    console.warn(`Extreme price impact detected: ${normalizedPriceImpact.toFixed(2)}%. User confirmation required.`);
  } else if (priceImpactLevel === 'high') {
    console.warn(`High price impact detected: ${normalizedPriceImpact.toFixed(2)}%. Consider using a larger amount for better rates.`);
  }

  return res;
}

/**
 * Get Pendle swap transaction data for gas estimation (without executing)
 * @param marketAddress The Pendle market address
 * @param tokenIn Address of the input token
 * @param tokenOut Address of the output token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param enableAggregator Whether to enable swap aggregator
 * @param chainId Chain ID
 * @param userWalletAddress User's wallet address
 * @returns Transaction data for gas estimation
 */
export async function getPendleSwapTransactionData(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true,
  chainId: number,
  userWalletAddress: string
) {
  // Get the swap data (same as we do before execution)
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

  // Return transaction data for gas estimation
  return {
    to: swapResult.tx.to,
    from: userWalletAddress,
    data: swapResult.tx.data,
    value: swapResult.tx.value || '0x0',
    swapData: swapResult.data
  };
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
  try {
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
  } catch (error: any) {
    // Handle specific transaction execution errors
    if (error.message?.includes('feed is unhealthy') || error.message?.includes('DF: feed is unhealthy')) {
      throw new Error('Price oracle feed is currently unhealthy. This is a safety mechanism to prevent trades during unreliable market conditions. Please try again later or use an alternative DEX.');
    }
    
    if (error.message?.includes('execution reverted')) {
      // Provide more specific error reasons based on common failure patterns
      let specificReason = '';
      
      if (error.message?.includes('Insufficient balance for transaction') || error.message?.includes('gas fees')) {
        // Extract gas fee amount from error message if available
        const gasFeeMatch = error.message.match(/(\d+\.?\d*) ETH gas fees/);
        const balanceMatch = error.message.match(/Your balance: (\d+\.?\d*) ETH/);
        
        if (gasFeeMatch && balanceMatch) {
          const gasFee = gasFeeMatch[1];
          const balance = balanceMatch[1];
          specificReason = `Gas fees (${gasFee} ETH ≈ $${(parseFloat(gasFee) * 3000).toFixed(0)}) exceed your balance (${balance} ETH). Network congestion is causing very high gas prices.`;
        } else {
          specificReason = 'Insufficient ETH balance to cover gas fees. Current gas prices are very high due to network congestion.';
        }
      } else if (error.message?.includes('insufficient balance') || error.message?.includes('transfer amount exceeds balance')) {
        specificReason = 'Insufficient ETH balance in your wallet.';
      } else if (error.message?.includes('slippage') || error.message?.includes('SLIPPAGE_EXCEEDED')) {
        specificReason = 'Slippage tolerance too low for current market conditions. Try increasing slippage to 2-5%.';
      } else if (error.message?.includes('EXPIRED') || error.message?.includes('deadline')) {
        specificReason = 'Transaction deadline exceeded. Market conditions changed during execution.';
      } else if (error.message?.includes('INSUFFICIENT_OUTPUT_AMOUNT') || error.message?.includes('MinimumAmountOut')) {
        specificReason = 'Expected output amount not met due to price movement. Try increasing slippage tolerance.';
      } else if (error.message?.includes('no data present') || error.message?.includes('require(false)')) {
        specificReason = 'Transaction validation failed. This could be due to: insufficient balance, market conditions, or the specific token pair not being available for the requested amount.';
      } else if (error.message?.includes('TRANSFER_FROM_FAILED') || error.message?.includes('transfer failed')) {
        specificReason = 'Token transfer failed. Check if you have enough balance and token approvals.';
      } else if (error.message?.includes('Transaction was mined but reverted')) {
        // Extract the specific revert reason from our enhanced error message
        const revertMatch = error.message.match(/Transaction was mined but reverted: (.+)$/);
        if (revertMatch) {
          specificReason = revertMatch[1];
        } else {
          specificReason = 'Transaction was processed but failed during execution. This may be due to changing market conditions.';
        }
      } else if (error.message?.includes('Transaction reverted')) {
        specificReason = error.message; // Use the detailed reason from transaction replay
      } else {
        specificReason = 'Unknown transaction failure. This may be due to market conditions, insufficient balance, or slippage tolerance.';
      }
      
      throw new Error(`Transaction failed: ${specificReason}`);
    }
    
    // Handle gas-related errors
    if (error.message?.includes('gas') || error.message?.includes('GAS_LIMIT') || error.message?.includes('out of gas')) {
      throw new Error('Transaction failed due to gas issues. This could be network congestion or insufficient gas limit.');
    }
    
    // Handle network errors
    if (error.message?.includes('network') || error.message?.includes('connection') || error.message?.includes('timeout')) {
      throw new Error('Network connection error. Please check your internet connection and try again.');
    }
    
    // Re-throw with original error message
    throw error;
  }
}

/**
 * Get enhanced gas estimation for Pendle swap with fork-aware fallbacks
 * @param marketAddress The Pendle market address
 * @param tokenIn Address of the input token
 * @param tokenOut Address of the output token
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 * @param enableAggregator Whether to enable swap aggregator
 * @param chainId Chain ID
 * @param userWalletAddress User's wallet address
 * @param isDemo Whether this is demo mode
 * @returns Enhanced gas estimation with revert reason handling
 */
export async function getPendleSwapGasEstimate(
  marketAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippage: number = 0.01,
  enableAggregator: boolean = true,
  chainId: number,
  userWalletAddress: string,
  isDemo: boolean = false
) {
  try {
    // Get transaction data first
    const txData = await getPendleSwapTransactionData(
      marketAddress,
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      enableAggregator,
      chainId,
      userWalletAddress
    );

    // Use robust gas estimation with enhanced error handling
    const { robustGasEstimation } = await import('../utils/robust-gas-estimation');
    
    const gasEstimate = await robustGasEstimation(
      {
        to: txData.to,
        from: txData.from,
        data: txData.data,
        value: txData.value
      },
      chainId,
      isDemo
    );

    return {
      ...gasEstimate,
      swapData: txData.swapData,
      transactionData: {
        to: txData.to,
        from: txData.from,
        data: txData.data,
        value: txData.value
      }
    };
  } catch (error: any) {
    console.error('Enhanced gas estimation failed:', error);
    
    // If gas estimation fails completely, provide a fallback response
    // This helps users understand what went wrong
    return {
      gasLimit: BigInt(800000), // Conservative fallback for Pendle swaps
      gasPrice: BigInt(0),
      totalGasCost: BigInt(0),
      totalGasCostEth: '0',
      totalGasCostUsd: '0',
      userBalance: BigInt(0),
      userBalanceEth: '0',
      userBalanceUsd: '0',
      isBalanceSufficient: false,
      shortfallEth: '0',
      shortfallUsd: '0',
      estimationMethod: 'fallback' as const,
      dataSource: 'Error Fallback',
      revertReason: error.message,
      isForkEnvironment: true, // Assume fork if estimation fails
      transactionWouldRevert: true,
      error: error.message
    };
  }
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

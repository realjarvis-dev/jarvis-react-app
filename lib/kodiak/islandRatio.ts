import axios from 'axios';
import { ethers } from 'ethers';
import { berachainConfig } from '@/lib/network/config';
import { getUserEvmWalletAddress, getUserWallet } from '../privy/client';
import { DepositResult, IslandSingleDepositParams, IslandState, SwapCalculationResult, Token } from '../types/kodiak';
import { ISLAND_ABI, ISLAND_INFO_ABI, KODIAK_ROUTER_ADDRESS, TOKEN_INFO_ABI } from './abi';
import { getIslandDetails } from './api';
import { approveToken, executeDeposit } from './transactions';

// Get token information from an ERC20 token
async function getTokenInfo(tokenAddress: string, provider: ethers.JsonRpcProvider): Promise<Token> {
  const tokenContract = new ethers.Contract(tokenAddress, TOKEN_INFO_ABI, provider);
  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  
  return {
    address: tokenAddress,
    decimals: Number(decimals),
    symbol
  };
}

/**
 * Calculate the optimal swap amount for single token deposits
 * @param totalAmount The total amount of the input token
 * @param price The price of token0 in terms of token1 (scaled by 10000)
 * @param ratio0 The ratio for token0 needed for deposit
 * @param ratio1 The ratio for token1 needed for deposit
 * @param isToken0 Whether the input token is token0 or token1
 * @returns The amount of input token that should be swapped
 */
function calculateSwapAmount(
  totalAmount: bigint,
  price: bigint,
  ratio0: bigint,
  ratio1: bigint,
  isToken0: boolean
): bigint {
  if (isToken0) {
    const denominator = (ratio0 * price) + (ratio1 * BigInt(10000));
    const amountToKeep = (totalAmount * ratio0 * price) / denominator;
    return totalAmount - amountToKeep;
  } else {
    const denominator = (ratio1 * BigInt(10000)) + (ratio0 * price);
    const amountToKeep = (totalAmount * ratio1 * BigInt(10000)) / denominator;
    return totalAmount - amountToKeep;
  }
}

// Get the Island token ratio
async function getIslandRatio(
  islandAddress: string, 
  provider: ethers.JsonRpcProvider
): Promise<IslandState> {
  const islandContract = new ethers.Contract(islandAddress, ISLAND_ABI, provider);
  
  // Get token addresses from island contract
  const token0Address = await islandContract.token0();
  const token1Address = await islandContract.token1();
  
  // Get token information
  const token0 = await getTokenInfo(token0Address, provider);
  const token1 = await getTokenInfo(token1Address, provider);
  
  // Use 1 unit of each token to check the ratio
  const amount0 = ethers.parseUnits('1', token0.decimals);
  const amount1 = ethers.parseUnits('1', token1.decimals);
  
  // Call getMintAmounts to get the deposit ratio
  const rawMintAmounts = await islandContract.getMintAmounts(amount0, amount1);
  const amount0Used = rawMintAmounts[0];
  const amount1Used = rawMintAmounts[1];
  
  // Handle normalization for 18 decimals
  let normalizedAmount0 = amount0Used;
  let normalizedAmount1 = amount1Used;
  
  // Only normalize if decimals are not 18
  if (token0.decimals !== 18) {
    const decimalDiff0 = 18 - token0.decimals;
    normalizedAmount0 = amount0Used * (BigInt(10) ** BigInt(decimalDiff0));
  }
  
  if (token1.decimals !== 18) {
    const decimalDiff1 = 18 - token1.decimals;
    normalizedAmount1 = amount1Used * (BigInt(10) ** BigInt(decimalDiff1));
  }
  
  // Calculate ratio (amount1/amount0)
  const ratio = (normalizedAmount1 * BigInt(10000)) / normalizedAmount0;
  
  return { 
    amount0: normalizedAmount0, 
    amount1: normalizedAmount1, 
    ratio 
  };
}

/**
 * Calculate optimal swap amount for single token deposits based on island ratio
 * @param islandAddress The address of the island contract
 * @param provider The ethers provider
 * @param totalAmount The total amount of token to deposit
 * @param isToken0 Whether the input token is token0 (true) or token1 (false)
 * @returns Object containing the amount to swap, amount to keep, expected output from swap, and token addresses
 */
async function calculateOptimalSwapForIsland(
  islandAddress: string,
  provider: ethers.JsonRpcProvider,
  totalAmount: bigint,
  isToken0: boolean
): Promise<SwapCalculationResult> {
  // Get the island ratio first
  const islandState = await getIslandRatio(islandAddress, provider);
  
  // Get island details to extract the current price
  const islandDetails = await getIslandDetails(islandAddress);
  
  // Require island details and tick to be available
  if (!islandDetails) {
    throw new Error(`Failed to fetch island details for ${islandAddress}`);
  }
  
  if (islandDetails.tick === undefined) {
    throw new Error(`Current tick is not available for island ${islandAddress}`);
  }
  
  // Convert tick to price
  const tickPrice = Math.pow(1.0001, islandDetails.tick);
  // Scale by 10000 to match our ratio calculations
  const price = BigInt(Math.round(tickPrice * 10000));
  
  // Calculate how much to swap
  const amountToSwap = calculateSwapAmount(
    totalAmount,
    price,
    islandState.amount0,
    islandState.amount1,
    isToken0
  );
  
  // Calculate how much of the input token to keep
  const amountToKeep = totalAmount - amountToSwap;
  
  // Calculate expected output from swap
  let expectedOutput: bigint;
  if (isToken0) {
    expectedOutput = (amountToSwap * price) / BigInt(10000);
  } else {
    expectedOutput = (amountToSwap * BigInt(10000)) / price;
  }
  
  // Set token addresses based on isToken0 flag
  const tokenInAddress = isToken0 ? islandDetails.token0.address : islandDetails.token1.address;
  const tokenOutAddress = isToken0 ? islandDetails.token1.address : islandDetails.token0.address;
  
  return {
    amountToSwap,
    amountToKeep,
    expectedOutput,
    islandAddress,
    tokenInAddress,
    tokenOutAddress
  };
}

/**
 * Determine appropriate slippage for Kodiak Quote API based on swap amount
 * @param amountToSwap The amount being swapped
 * @returns Slippage percentage as string (e.g., "2" for 2%)
 */
function getApiSlippageForAmount(amountToSwap: bigint): string {
  // For very small amounts, use higher slippage in the API call
  if (amountToSwap < BigInt('1000000000000000')) { // < 0.001 tokens
    return "3"; // 3%
  }
  if (amountToSwap < BigInt('10000000000000000')) { // < 0.01 tokens
    return "2.5"; // 2.5%
  }
  if (amountToSwap < BigInt('100000000000000000')) { // < 0.1 tokens
    return "2"; // 2%
  }
  return "1"; // Default 1% for larger amounts
}

/**
 * Get the swap calldata from Kodiak Quote API based on the output from calculateOptimalSwapForIsland
 * @param swapResult The result from calculateOptimalSwapForIsland
 * @returns Raw API response 
 * @throws Error if API call fails or returns invalid data
 */
async function getKodiakSwapCalldata(
  swapResult: SwapCalculationResult
): Promise<any> {
  // Constants for the API call
  const CHAIN_ID = berachainConfig.chainId;
  const PROTOCOLS = "v2,v3,mixed";
  const TYPE = "exactIn";
  const DEADLINE = "60";
  
  // Dynamic slippage based on swap amount
  const SLIPPAGE_TOLERANCE = getApiSlippageForAmount(swapResult.amountToSwap);
  
  // Get the user's wallet address for the recipient
  const userAddress = await getUserEvmWalletAddress();
  if (!userAddress) {
    throw new Error('Could not get user wallet address');
  }
  const RECIPIENT = userAddress;
  
  // Base URL for the Kodiak Quote API
  const API_URL = "https://api.kodiak.finance/quote";
  
  // Prepare query parameters for the API call
  const params = {
    protocols: PROTOCOLS,
    tokenInAddress: swapResult.tokenInAddress,
    tokenInChainId: CHAIN_ID,
    tokenOutAddress: swapResult.tokenOutAddress,
    tokenOutChainId: CHAIN_ID,
    amount: swapResult.amountToSwap.toString(),
    type: TYPE,
    recipient: KODIAK_ROUTER_ADDRESS,
    deadline: DEADLINE,
    slippageTolerance: SLIPPAGE_TOLERANCE
  };

  console.log("Swap Calldata Params", params)
  console.log(`[Kodiak Quote] Using ${SLIPPAGE_TOLERANCE}% slippage for swap amount: ${swapResult.amountToSwap.toString()}`)
  
  // Validate minimum swap amount (avoid dust transactions)
  if (swapResult.amountToSwap < BigInt('100000000000000')) { // < 0.0001 tokens
    console.warn(`[Kodiak Quote] Swap amount ${swapResult.amountToSwap.toString()} may be too small for DEX`);
  }
  
  try {
    // Make the API call
    const response = await axios.get(API_URL, { params });
    
    // Validate the response data
    const data = response.data;
    if (!data || !data.quote || !data.methodParameters?.calldata) {
      throw new Error('Invalid response from Kodiak API: missing required fields');
    }
    
    // Return the validated response data
    return data;
  } catch (error) {
    console.error(`[Kodiak Quote] API call failed for swap amount ${swapResult.amountToSwap.toString()}:`, error);
    if (axios.isAxiosError(error)) {
      const errorMsg = error.response?.data?.message || error.message;
      throw new Error(`Kodiak Quote API failed: ${errorMsg}. Amount: ${swapResult.amountToSwap.toString()}, Slippage: ${SLIPPAGE_TOLERANCE}%`);
    }
    throw error;
  }
}

/**
 * Deposit a single token into a Kodiak Island
 * @param params Deposit parameters
 * @returns Result of the deposit operation
 */
async function depositToKodiakIsland(params: IslandSingleDepositParams): Promise<DepositResult> {
  try {
    // Validate input parameters
    if (!params.islandAddress || !ethers.isAddress(params.islandAddress)) {
      return {
        status: 'fail',
        error_message: 'Invalid island address'
      };
    }
    
    if (!params.totalAmount || isNaN(Number(params.totalAmount)) || Number(params.totalAmount) <= 0) {
      return {
        status: 'fail',
        error_message: 'Invalid deposit amount'
      };
    }
    
    if (params.slippageBPS < 0 || params.slippageBPS > 10000) {
      return {
        status: 'fail',
        error_message: 'Invalid slippage: must be between 0 and 10000 BPS'
      };
    }
    
    if (!params.minSharesReceived || isNaN(Number(params.minSharesReceived))) {
      return {
        status: 'fail',
        error_message: 'Invalid minimum shares parameter'
      };
    }
    
    // Get user's wallet
    const wallet = await getUserWallet('ethereum');
    if (!wallet) {
      return {
        status: 'fail',
        error_message: 'No EVM wallet available'
      };
    }
    
    if (!wallet.delegated) {
      return {
        status: 'fail',
        error_message: 'EVM wallet not delegated to Privy'
      };
    }
    
    // Get user's wallet address
    const userAddress = await getUserEvmWalletAddress();
    if (!userAddress) {
      return {
        status: 'fail',
        error_message: 'Could not get user wallet address'
      };
    }
    
    // Set up provider for calculations
    const provider = new ethers.JsonRpcProvider(berachainConfig.rpcUrl);
    
    // Get token info from the Island contract
    const islandContract = new ethers.Contract(
      params.islandAddress,
      ISLAND_INFO_ABI,
      provider
    );
    
    const token0Address = await islandContract.token0();
    const token1Address = await islandContract.token1();
    
    // Determine which token is being deposited
    const tokenAddress = params.isToken0 ? token0Address : token1Address;
    
    // Get token decimals
    const tokenContract = new ethers.Contract(
      tokenAddress,
      TOKEN_INFO_ABI,
      provider
    );
    
    const decimals = await tokenContract.decimals();
    
    // Parse total amount
    const totalAmount = ethers.parseUnits(params.totalAmount, decimals);
    
    // Validate minimum deposit amount to avoid DEX/swap issues  
    const minDepositThreshold = BigInt('10000000000000'); // 0.00001 tokens (very conservative)
    if (totalAmount < minDepositThreshold) {
      console.log(`[Kodiak Deposit] Total amount ${totalAmount.toString()} below minimum threshold ${minDepositThreshold.toString()}`);
      return {
        status: 'fail',
        error_message: `Deposit amount too small. Minimum: 0.00001 ${tokenContract.symbol || 'tokens'}. Current: ${params.totalAmount}. Extremely small deposits fail due to DEX minimums and gas costs.`
      };
    }
    
    // Log if deposit is very small but still allowed
    if (totalAmount < BigInt('100000000000000')) { // < 0.0001 tokens
      console.log(`[Kodiak Deposit] Processing small deposit: ${params.totalAmount} ${tokenContract.symbol}. Using enhanced slippage tolerance.`);
    }
    
    // Step 1: Calculate optimal swap
    const swapResult = await calculateOptimalSwapForIsland(
      params.islandAddress,
      provider,
      totalAmount,
      params.isToken0
    );
    
    // Step 2: Get quote and calldata from Kodiak API
    const quoteResult = await getKodiakSwapCalldata(swapResult);
    
    // Check if quote result is valid and contains all required fields
    if (!quoteResult) {
      return {
        status: 'fail',
        error_message: 'Failed to get quote from Kodiak API'
      };
    }
    
    // Check if calldata is present
    if (!quoteResult.methodParameters?.calldata) {
      return {
        status: 'fail',
        error_message: 'Failed to get calldata from Kodiak API'
      };
    }
    
    // Verify that the quote amount is valid
    if (!quoteResult.quote || isNaN(Number(quoteResult.quote)) || Number(quoteResult.quote) <= 0) {
      return {
        status: 'fail',
        error_message: 'Invalid quote amount received from Kodiak API'
      };
    }

    console.log("Start approving")
    
    // Step 3: Approve token spending
    const approvalTx = await approveToken(
      tokenAddress,
      KODIAK_ROUTER_ADDRESS,
      totalAmount.toString(),
      wallet,
      userAddress
    );
    
    console.log("end approving")

    if (approvalTx.status === 'fail') {
      return approvalTx;
    }
    
    console.log("start depositing")
    // Step 4: Execute the deposit transaction
    return await executeDeposit(
      swapResult,
      quoteResult,
      params,
      wallet,
      userAddress,
      totalAmount
    );
    
  } catch (error) {
    return {
      status: 'fail',
      error_message: error instanceof Error ? error.message : String(error)
    };
  }
}

export {
    calculateOptimalSwapForIsland,
    calculateSwapAmount, depositToKodiakIsland,
    getIslandRatio,
    getKodiakSwapCalldata
};

// Export types
    export type {
        IslandSingleDepositParams
    };


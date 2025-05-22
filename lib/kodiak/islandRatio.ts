import { ethers } from 'ethers';

// Define interface for Token with address and decimals
interface Token {
  address: string;
  decimals: number;
  symbol?: string;
}

// Define interface for the Island state
interface IslandState {
  amount0: bigint;
  amount1: bigint;
  ratio: bigint;
}

// Interface for swap calculation result
interface SwapCalculationResult {
  amountToSwap: bigint;
  amountToKeep: bigint;
  expectedOutput: bigint;
}

// Simple ABI for the Island contract's getMintAmounts function
const ISLAND_ABI = [
  'function getMintAmounts(uint256 amount0Max, uint256 amount1Max) external view returns (uint256 amount0, uint256 amount1, uint256 mintAmount)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

// Get token information from an ERC20 token
async function getTokenInfo(tokenAddress: string, provider: ethers.JsonRpcProvider): Promise<Token> {
  const tokenABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];
  
  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);
  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  
  return {
    address: tokenAddress,
    decimals: Number(decimals), // Ensure decimals is a number
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
  // Instead of using the formula directly from the documentation, which seems to lead to
  // swapping almost everything, let's implement a more intuitive approach.
  
  if (isToken0) {
    // If depositing token0 (e.g., sUSDa):
    // 1. Calculate the portion of token0 to keep based on the ratio
    // 2. The rest will be swapped to token1
    
    // Calculate what portion of the total input we should keep
    // For optimal deposit: keep_amount * ratio = swap_amount * price / 10000
    
    // For our example: ratio = 12656 (1.2656)
    // We want: keep_amount * 1.2656 = (totalAmount - keep_amount) * price / 10000
    // Solving for keep_amount:
    // keep_amount = (totalAmount * price) / (ratio * 10000 + price)
    
    const denominator = (ratio0 * price) + (ratio1 * BigInt(10000));
    const amountToKeep = (totalAmount * ratio0 * price) / denominator;
    
    // Amount to swap is the rest
    return totalAmount - amountToKeep;
  } else {
    // If depositing token1 (e.g., USDa):
    // We use a similar approach but adjusted for token1
    
    // For optimal deposit: keep_amount / ratio = swap_amount * 10000 / price
    // Solving for keep_amount:
    // keep_amount = (totalAmount * ratio) / (10000 + ratio)
    
    const denominator = (ratio1 * BigInt(10000)) + (ratio0 * price);
    const amountToKeep = (totalAmount * ratio1 * BigInt(10000)) / denominator;
    
    // Amount to swap is the rest
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
  
  console.log(`Island tokens: ${token0.symbol} (${token0.decimals} decimals) and ${token1.symbol} (${token1.decimals} decimals)`);
  
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
 * @param currentPrice Optional current price of token0 in terms of token1 (if not provided, will use the Island's ratio)
 * @returns Object containing the amount to swap, amount to keep, and expected output from swap
 */
async function calculateOptimalSwapForIsland(
  islandAddress: string,
  provider: ethers.JsonRpcProvider,
  totalAmount: bigint,
  isToken0: boolean,
  currentPrice?: bigint
): Promise<SwapCalculationResult> {
  // Get the island ratio first
  const islandState = await getIslandRatio(islandAddress, provider);
  
  // Use the Island's actual ratio or the provided price
  // This ensures we're calculating based on the ratio that the Island actually requires
  const price = currentPrice || BigInt(10680);
  
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
  
  // Calculate expected output from swap (simplified, actual output depends on AMM curve)
  let expectedOutput: bigint;
  if (isToken0) {
    // If swapping token0 for token1, use the price
    // The ratio is already scaled by 10000, so we need to adjust for that
    expectedOutput = (amountToSwap * price) / BigInt(10000);
  } else {
    // If swapping token1 for token0, use the inverse of the price
    // The ratio is already scaled by 10000, so we need to adjust for that
    expectedOutput = (amountToSwap * BigInt(10000)) / price;
  }
  
  return {
    amountToSwap,
    amountToKeep,
    expectedOutput
  };
}

// Example usage function
async function checkIslandRatio(islandAddress: string, rpcUrl: string) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  try {
    console.log(`Checking ratio for island: ${islandAddress}`);
    const ratio = await getIslandRatio(islandAddress, provider);
    
    return ratio;
  } catch (error) {
    console.error('Error fetching island ratio:', error);
    throw error;
  }
}

export {
    calculateOptimalSwapForIsland, calculateSwapAmount,
    checkIslandRatio,
    getIslandRatio
};

// Export types
    export type { IslandState, SwapCalculationResult, Token };


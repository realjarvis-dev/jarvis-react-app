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

export { checkIslandRatio, getIslandRatio };


import { ethers } from 'ethers';
import { BerachainMainnetConfig } from '../config/network';
import type { SwapCalculationResult } from './islandRatio';
import { calculateOptimalSwapForIsland, getIslandRatio } from './islandRatio';

// Use the Berachain Mainnet RPC URL from network config
const RPC_URL = BerachainMainnetConfig.rpcUrl;

// Use the same Island address as in testIsland.ts
const ISLAND_ADDRESS = '0x7cebcc76a2faecc0ae378b340815fcbb71ec1fe0';

// Example token amount to deposit (in ETH)
const DEPOSIT_AMOUNT = '1.0';

async function testSingleTokenDeposit() {
  try {
    console.log('Testing single token deposit calculation');
    console.log(`Using Berachain Mainnet RPC: ${RPC_URL}`);
    
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Get the island ratio first to understand the tokens
    console.log(`Getting island ratio for ${ISLAND_ADDRESS}`);
    const islandState = await getIslandRatio(ISLAND_ADDRESS, provider);
    
    console.log(`Island ratio results:`);
    console.log(`- Token0 amount: ${islandState.amount0.toString()}`);
    console.log(`- Token1 amount: ${islandState.amount1.toString()}`);
    console.log(`- Ratio: ${islandState.ratio.toString()}`);
    console.log(`- Ratio as decimal: ${Number(islandState.ratio) / 10000}`);
    
    // Get information about the tokens
    const islandContract = new ethers.Contract(
      ISLAND_ADDRESS, 
      ['function token0() external view returns (address)', 'function token1() external view returns (address)'],
      provider
    );
    
    const token0Address = await islandContract.token0();
    const token1Address = await islandContract.token1();
    
    const token0Contract = new ethers.Contract(
      token0Address,
      ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
      provider
    );
    
    const token1Contract = new ethers.Contract(
      token1Address,
      ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
      provider
    );
    
    const token0Symbol = await token0Contract.symbol();
    const token0Decimals = await token0Contract.decimals();
    const token1Symbol = await token1Contract.symbol();
    const token1Decimals = await token1Contract.decimals();
    
    console.log(`Token0: ${token0Symbol} (${token0Address})`);
    console.log(`Token1: ${token1Symbol} (${token1Address})`);
    console.log(`This means for every 1 unit of ${token0Symbol}, you need ${Number(islandState.ratio) / 10000} units of ${token1Symbol}`);
    
    // Test depositing token0
    console.log(`\nTesting deposit of ${DEPOSIT_AMOUNT} ${token0Symbol}`);
    const depositAmount0 = ethers.parseUnits(DEPOSIT_AMOUNT, token0Decimals);
    
    // Calculate optimal swap for token0 deposit
    const swapResult0 = await calculateOptimalSwapForIsland(
      ISLAND_ADDRESS,
      provider,
      depositAmount0,
      true // isToken0 = true
    );
    
    printSwapDetails(swapResult0, token0Symbol, token1Symbol, token0Decimals, token1Decimals);
    
    // Test depositing token1
    console.log(`\nTesting deposit of ${DEPOSIT_AMOUNT} ${token1Symbol}`);
    const depositAmount1 = ethers.parseUnits(DEPOSIT_AMOUNT, token1Decimals);
    
    // Calculate optimal swap for token1 deposit
    const swapResult1 = await calculateOptimalSwapForIsland(
      ISLAND_ADDRESS,
      provider,
      depositAmount1,
      false // isToken0 = false
    );
    
    printSwapDetails(swapResult1, token1Symbol, token0Symbol, token1Decimals, token0Decimals);
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

function printSwapDetails(
  result: SwapCalculationResult,
  inputTokenSymbol: string,
  outputTokenSymbol: string,
  inputDecimals: number,
  outputDecimals: number
) {
  console.log('Swap calculation results:');
  console.log(`- Amount to swap: ${ethers.formatUnits(result.amountToSwap, inputDecimals)} ${inputTokenSymbol}`);
  console.log(`- Amount to keep: ${ethers.formatUnits(result.amountToKeep, inputDecimals)} ${inputTokenSymbol}`);
  console.log(`- Expected output: ${ethers.formatUnits(result.expectedOutput, outputDecimals)} ${outputTokenSymbol}`);
  
  // Calculate the percentage being swapped
  const percentSwap = (Number(result.amountToSwap) / (Number(result.amountToSwap) + Number(result.amountToKeep))) * 100;
  console.log(`- Percentage to swap: ${percentSwap.toFixed(2)}%`);
}

// Run the test
testSingleTokenDeposit()
  .then(() => console.log('Test completed'))
  .catch(error => console.error('Test failed:', error)); 
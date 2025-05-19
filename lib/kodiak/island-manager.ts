/**
 * Kodiak Island Manager - Handles investment operations for Kodiak Islands
 */

import { ethers } from 'ethers';
import { BepoliaConfig, BerachainMainnetConfig } from '../config/network';
import { calculateMinimumWithSlippage as calculateMin } from './utils';

// ABI fragments for investment operations
const ISLAND_ROUTER_ABI = [
  // Deposit liquidity
  'function addLiquidity(address island, uint256 amount0Max, uint256 amount1Max, uint256 amount0Min, uint256 amount1Min, uint256 amountSharesMin, address receiver) external returns (uint256 amount0, uint256 amount1, uint256 mintAmount)',
  
  // Single-sided deposit (zap)
  'function addLiquiditySingleToken(address island, bool zeroForOne, uint256 amountIn, uint256 amountMin, uint256 amountSharesMin, address receiver) external returns (uint256 amountAdded, uint256 mintAmount)',
  
  // Withdraw liquidity
  'function removeLiquidity(address island, uint256 burnAmount, uint256 amount0Min, uint256 amount1Min, address receiver) external returns (uint256 amount0, uint256 amount1)',
  
  // Single-sided withdraw (zap)
  'function removeLiquiditySingleToken(address island, uint256 burnAmount, bool zeroForOne, uint256 minAmountOut, address receiver) external returns (uint256 amountOut)'
];

// Router contract addresses
const ROUTER_ADDRESSES = {
  bepolia: '0x558dA0ff61Bca43453d8bD1e0b6c89cCeA8a597d',
  mainnet: '0x679a7C63FC83b6A4D9C1F931891d705483d4791F'
};

/**
 * Calculate the minimum token amounts based on slippage
 * @param amount Token amount
 * @param slippagePercentage Slippage percentage (e.g., 0.5 for 0.5%)
 * @returns Minimum token amount after slippage
 */
export function calculateMinimumWithSlippage(
  amount: string, 
  slippagePercentage: number = 0.5
): string {
  const amountBn = ethers.toBigInt(amount);
  const slippageBPS = Math.floor(slippagePercentage * 100);
  return calculateMin(amountBn, slippageBPS).toString();
}

/**
 * Calculate the amount of tokens to swap for single-sided deposits
 * @param amount0 Amount of token0
 * @param amount1 Amount of token1
 * @param ratio0 Ratio of token0 in the position
 * @param ratio1 Ratio of token1 in the position
 * @returns The amount to swap
 */
export function calculateSwapAmount(
  amount0: string,
  amount1: string,
  ratio0: number,
  ratio1: number
): { swapAmount: string; zeroForOne: boolean } {
  const amount0Bn = ethers.toBigInt(amount0);
  const amount1Bn = ethers.toBigInt(amount1);
  
  // If we have only token0
  if (amount1Bn === BigInt(0)) {
    return { swapAmount: (amount0Bn * ethers.toBigInt(Math.floor(ratio1 * 100)) / ethers.toBigInt(100)).toString(), zeroForOne: true };
  }
  
  // If we have only token1
  if (amount0Bn === BigInt(0)) {
    return { swapAmount: (amount1Bn * ethers.toBigInt(Math.floor(ratio0 * 100)) / ethers.toBigInt(100)).toString(), zeroForOne: false };
  }
  
  // If we have both tokens but not in the correct ratio
  const currentRatio0 = Number(amount0) / (Number(amount0) + Number(amount1));
  if (currentRatio0 > ratio0) {
    // We have too much token0, swap some for token1
    const excessAmount0 = amount0Bn - (amount0Bn + amount1Bn) * ethers.toBigInt(Math.floor(ratio0 * 100)) / ethers.toBigInt(100);
    return { swapAmount: excessAmount0.toString(), zeroForOne: true };
  } else {
    // We have too much token1, swap some for token0
    const excessAmount1 = amount1Bn - (amount0Bn + amount1Bn) * ethers.toBigInt(Math.floor(ratio1 * 100)) / ethers.toBigInt(100);
    return { swapAmount: excessAmount1.toString(), zeroForOne: false };
  }
}

/**
 * Create a provider based on the network
 */
function getProvider(network: 'bepolia' | 'mainnet' = 'mainnet') {
  const config = network === 'bepolia' ? BepoliaConfig : BerachainMainnetConfig;
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

/**
 * Get the router contract instance
 */
function getRouterContract(
  provider: ethers.JsonRpcProvider,
  network: 'bepolia' | 'mainnet' = 'mainnet'
): ethers.Contract {
  return new ethers.Contract(ROUTER_ADDRESSES[network], ISLAND_ROUTER_ABI, provider);
}

/**
 * Interface for deposit parameters
 */
export interface DepositParams {
  islandAddress: string;
  amount0: string;
  amount1: string;
  slippagePercentage?: number;
  receiver?: string;
  network?: 'bepolia' | 'mainnet';
}

/**
 * Interface for single-sided deposit parameters
 */
export interface SingleSidedDepositParams {
  islandAddress: string;
  tokenAmount: string;
  isToken0: boolean;
  slippagePercentage?: number;
  receiver?: string;
  network?: 'bepolia' | 'mainnet';
}

/**
 * Interface for withdrawal parameters
 */
export interface WithdrawParams {
  islandAddress: string;
  shareAmount: string;
  slippagePercentage?: number;
  receiver?: string;
  network?: 'bepolia' | 'mainnet';
}

/**
 * Interface for single-sided withdrawal parameters
 */
export interface SingleSidedWithdrawParams {
  islandAddress: string;
  shareAmount: string;
  withdrawToken0: boolean;
  slippagePercentage?: number;
  receiver?: string;
  network?: 'bepolia' | 'mainnet';
}

/**
 * Generate transaction data for depositing into a Kodiak Island
 */
export function generateDepositTx(params: DepositParams): ethers.TransactionRequest {
  const {
    islandAddress,
    amount0,
    amount1,
    slippagePercentage = 0.5,
    receiver = ethers.ZeroAddress,
    network = 'mainnet'
  } = params;
  
  // Calculate minimum amounts with slippage
  const amount0Min = calculateMinimumWithSlippage(amount0, slippagePercentage);
  const amount1Min = calculateMinimumWithSlippage(amount1, slippagePercentage);
  const amountSharesMin = '0'; // We accept any amount of shares
  
  // Create router contract
  const provider = getProvider(network);
  const router = getRouterContract(provider, network);
  
  // Generate transaction data
  return {
    to: ROUTER_ADDRESSES[network],
    data: router.interface.encodeFunctionData('addLiquidity', [
      islandAddress,
      amount0,
      amount1,
      amount0Min,
      amount1Min,
      amountSharesMin,
      receiver || ethers.ZeroAddress
    ])
  };
}

/**
 * Generate transaction data for single-sided deposit into a Kodiak Island
 */
export function generateSingleSidedDepositTx(params: SingleSidedDepositParams): ethers.TransactionRequest {
  const {
    islandAddress,
    tokenAmount,
    isToken0,
    slippagePercentage = 0.5,
    receiver = ethers.ZeroAddress,
    network = 'mainnet'
  } = params;
  
  // Calculate minimum amount with slippage
  const amountMin = calculateMinimumWithSlippage(tokenAmount, slippagePercentage);
  const amountSharesMin = '0'; // We accept any amount of shares
  
  // Create router contract
  const provider = getProvider(network);
  const router = getRouterContract(provider, network);
  
  // Generate transaction data
  return {
    to: ROUTER_ADDRESSES[network],
    data: router.interface.encodeFunctionData('addLiquiditySingleToken', [
      islandAddress,
      !isToken0, // zeroForOne: true if we're using token1, false if we're using token0
      tokenAmount,
      amountMin,
      amountSharesMin,
      receiver || ethers.ZeroAddress
    ])
  };
}

/**
 * Generate transaction data for withdrawing from a Kodiak Island
 */
export function generateWithdrawTx(params: WithdrawParams): ethers.TransactionRequest {
  const {
    islandAddress,
    shareAmount,
    slippagePercentage = 0.5,
    receiver = ethers.ZeroAddress,
    network = 'mainnet'
  } = params;
  
  // We set min amounts to 0 because we already provide the share amount
  // In a production environment, you would want to estimate the expected output tokens
  const amount0Min = '0';
  const amount1Min = '0';
  
  // Create router contract
  const provider = getProvider(network);
  const router = getRouterContract(provider, network);
  
  // Generate transaction data
  return {
    to: ROUTER_ADDRESSES[network],
    data: router.interface.encodeFunctionData('removeLiquidity', [
      islandAddress,
      shareAmount,
      amount0Min,
      amount1Min,
      receiver || ethers.ZeroAddress
    ])
  };
}

/**
 * Generate transaction data for single-sided withdrawal from a Kodiak Island
 */
export function generateSingleSidedWithdrawTx(params: SingleSidedWithdrawParams): ethers.TransactionRequest {
  const {
    islandAddress,
    shareAmount,
    withdrawToken0,
    slippagePercentage = 0.5,
    receiver = ethers.ZeroAddress,
    network = 'mainnet'
  } = params;
  
  // We set minAmountOut to 0 for now
  // In a production environment, you would want to estimate the expected output token
  const minAmountOut = '0';
  
  // Create router contract
  const provider = getProvider(network);
  const router = getRouterContract(provider, network);
  
  // Generate transaction data
  return {
    to: ROUTER_ADDRESSES[network],
    data: router.interface.encodeFunctionData('removeLiquiditySingleToken', [
      islandAddress,
      shareAmount,
      withdrawToken0,
      minAmountOut,
      receiver || ethers.ZeroAddress
    ])
  };
} 
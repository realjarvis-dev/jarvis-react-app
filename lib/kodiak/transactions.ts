import {
    getUserEvmWalletAddress,
    getUserWallet,
    privy
} from '@/lib/privy/client'
import { ethers } from 'ethers'
import { v4 as uuidv4 } from 'uuid'
import { BepoliaConfig, BerachainMainnetConfig } from '../config/network'
import {
    calculateMinimumWithSlippage,
    calculateSwapAmount,
    generateSingleSidedDepositTx
} from './island-manager'

// Router contract addresses
const ROUTER_ADDRESSES = {
  bepolia: '0x558dA0ff61Bca43453d8bD1e0b6c89cCeA8a597d',
  mainnet: '0x679a7C63FC83b6A4D9C1F931891d705483d4791F'
};

// Island ABI for getting information about the island
const ISLAND_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getUnderlyingBalances() external view returns (uint256 amount0Current, uint256 amount1Current)',
  'function getMintAmounts(uint256 amount0Max, uint256 amount1Max) external view returns (uint256 amount0, uint256 amount1, uint256 mintAmount)'
];

/**
 * Calculates the optimal swap parameters for a single-sided deposit
 * @param islandAddress Address of the Kodiak Island
 * @param investAmount Amount to invest in wei
 * @param network Network to use (bepolia or mainnet)
 * @returns Swap parameters for the transaction
 */
export async function calculateSwapParameters(
  islandAddress: string,
  investAmount: string,
  network: 'bepolia' | 'mainnet' = 'mainnet'
): Promise<{ 
  zeroForOne: boolean;
  swapAmount: string;
  minAmountOut: string;
}> {
  try {
    // Get provider for the network
    const config = network === 'bepolia' ? BepoliaConfig : BerachainMainnetConfig;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Create island contract instance
    const island = new ethers.Contract(islandAddress, ISLAND_ABI, provider);
    
    // Get token addresses to determine which is WBERA
    const token0Address = await island.token0();
    const token1Address = await island.token1();
    
    // Get mint amounts to determine the proper ratio
    const testAmount = ethers.parseEther('1'); // 1 unit of each token for ratio calculation
    const mintAmounts = await island.getMintAmounts(testAmount, testAmount);
    const amount0Used = mintAmounts[0];
    const amount1Used = mintAmounts[1];
    
    // Calculate normalized ratio
    const ratio0 = Number(amount0Used) / (Number(amount0Used) + Number(amount1Used));
    const ratio1 = 1 - ratio0;
    
    // Calculate swap amount
    const swapResult = calculateSwapAmount(
      investAmount, // All our BERA will be used
      '0', // We have 0 of the other token initially
      ratio0,
      ratio1
    );
    
    // Calculate minimum amount out with 1% slippage
    const minAmountOut = calculateMinimumWithSlippage(swapResult.swapAmount, 1); // 1% slippage
    
    return {
      zeroForOne: swapResult.zeroForOne,
      swapAmount: swapResult.swapAmount,
      minAmountOut
    };
  } catch (error: any) {
    console.error('Error calculating swap parameters:', error.message);
    throw new Error(`Failed to calculate swap parameters: ${error.message}`);
  }
}

/**
 * Invest in a Kodiak Island with native BERA using Privy wallet
 * @param islandAddress Address of the Kodiak Island
 * @param amountIn Amount to invest in BERA (in wei)
 * @param slippage Slippage tolerance percentage (e.g., 0.5 for 0.5%)
 * @param network Network to use (bepolia or mainnet)
 * @returns Promise with transaction hash
 */
export async function investInKodiakIsland(
  islandAddress: string,
  amountIn: string,
  slippage: number = 0.5,
  network: 'bepolia' | 'mainnet' = 'mainnet'
): Promise<{ hash: string }> {
  try {
    // Get user's EVM wallet address
    const userAddress = await getUserEvmWalletAddress();
    if (!userAddress) {
      throw new Error('EVM wallet not found');
    }
    
    console.log(`Using wallet address: ${userAddress}`);
    console.log(`Investing ${ethers.formatEther(amountIn)} BERA in island ${islandAddress}`);
    
    // Get the network configuration
    const config = network === 'bepolia' ? BepoliaConfig : BerachainMainnetConfig;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Check if user has sufficient balance
    const balance = await provider.getBalance(userAddress);
    if (BigInt(balance) < BigInt(amountIn)) {
      throw new Error(`Insufficient balance. You have ${ethers.formatEther(balance)} BERA but need ${ethers.formatEther(amountIn)}`);
    }
    
    // Calculate optimal swap parameters or use the island-manager function
    // Method 1: Generate transaction data directly
    const txData = generateSingleSidedDepositTx({
      islandAddress,
      tokenAmount: amountIn,
      isToken0: true, // Assuming WBERA is token0, will be handled in the function
      slippagePercentage: slippage,
      receiver: userAddress,
      network: network
    });
    
    console.log('Generated transaction data');
    
    // Verify that the transaction data is valid
    if (!txData || !txData.to || !txData.data) {
      throw new Error('Failed to generate valid transaction data');
    }
    
    // Get the EVM wallet for transaction signing
    const evmWallet = await getUserWallet('ethereum');
    if (!evmWallet) {
      throw new Error('EVM wallet not found');
    }
    if (!evmWallet.id) {
      throw new Error('EVM wallet ID not found');
    }
    
    // Get the latest block to estimate gas prices
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas || ethers.parseUnits('1', 'gwei');
    const maxFee = BigInt(baseFee) * BigInt(2); // 2× base fee
    const priority = ethers.parseUnits('1', 'gwei'); // 1 gwei priority fee
    
    // Prepare transaction parameters
    const to = (txData.to as string).replace(/^0x/, '');
    const data = (txData.data as string).replace(/^0x/, '');
    const value = amountIn;
    const valueHex = ethers.toQuantity(BigInt(value)).replace(/^0x/, '');
    
    // Sign the transaction with Privy
    console.log('Signing transaction with Privy...');
    const { signedTransaction } = await privy.walletApi.ethereum.signTransaction({
      walletId: evmWallet.id,
      transaction: {
        to: `0x${to}` as `0x${string}`,
        chainId: config.chainId,
        value: `0x${valueHex}` as `0x${string}`,
        data: `0x${data}` as `0x${string}`,
        gasLimit: 650000, // Conservative gas limit
        maxFeePerGas: ethers.toQuantity(maxFee + priority) as `0x${string}`,
        maxPriorityFeePerGas: ethers.toQuantity(priority) as `0x${string}`,
      },
      idempotencyKey: uuidv4() // unique key for this transaction
    });
    
    // Broadcast the signed transaction
    console.log('Broadcasting transaction...');
    const txResponse = await provider.broadcastTransaction(signedTransaction);
    console.log('Transaction hash:', txResponse.hash);
    
    // Return the transaction hash
    return {
      hash: txResponse.hash
    };
  } catch (error: any) {
    console.error('Error investing in Kodiak Island:', error.message);
    throw new Error(`Failed to invest in Kodiak Island: ${error.message}`);
  }
}

/**
 * Get the token balances and other info about a Kodiak Island
 * @param islandAddress Address of the Kodiak Island
 * @param network Network to use (bepolia or mainnet)
 * @returns Island information
 */
export async function getIslandInfo(
  islandAddress: string,
  network: 'bepolia' | 'mainnet' = 'mainnet'
): Promise<{
  token0Address: string;
  token1Address: string;
  token0Balance: string;
  token1Balance: string;
  ratio0: number;
  ratio1: number;
}> {
  try {
    // Get provider for the network
    const config = network === 'bepolia' ? BepoliaConfig : BerachainMainnetConfig;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Create island contract instance
    const island = new ethers.Contract(islandAddress, ISLAND_ABI, provider);
    
    // Get token addresses
    const token0Address = await island.token0();
    const token1Address = await island.token1();
    
    // Get balances
    const balances = await island.getUnderlyingBalances();
    const token0Balance = balances[0].toString();
    const token1Balance = balances[1].toString();
    
    // Get mint amounts to determine the proper ratio
    const testAmount = ethers.parseEther('1');
    const mintAmounts = await island.getMintAmounts(testAmount, testAmount);
    const amount0Used = mintAmounts[0];
    const amount1Used = mintAmounts[1];
    
    // Calculate normalized ratio
    const total = Number(amount0Used) + Number(amount1Used);
    const ratio0 = Number(amount0Used) / total;
    const ratio1 = Number(amount1Used) / total;
    
    return {
      token0Address,
      token1Address,
      token0Balance,
      token1Balance,
      ratio0,
      ratio1
    };
  } catch (error: any) {
    console.error('Error getting island info:', error.message);
    throw new Error(`Failed to get island info: ${error.message}`);
  }
} 
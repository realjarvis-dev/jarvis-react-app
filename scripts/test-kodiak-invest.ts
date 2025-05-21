import { PrivyClient } from '@privy-io/privy-node';
import { ethers } from 'ethers';
import { BepoliaConfig } from '../lib/config/network';
import {
    calculateMinimumWithSlippage,
    calculateSwapAmount,
    generateSingleSidedDepositTx
} from '../lib/kodiak/island-manager';

// Island details
const ISLAND_ADDRESS = '0x217b9476ecd8783c59ed0ed64c359b8f2b9ccd3a'; // WBERA-AIBERA island on testnet
const ROUTER_ADDRESS = '0x558dA0ff61Bca43453d8bD1e0b6c89cCeA8a597d'; // Router address on Bepolia

// Router ABI for interacting with the Island Router
const ROUTER_ABI = [
  'function addLiquiditySingleNative(address island, uint256 amountSharesMin, uint256 maxStakingSlippageBPS, tuple(bool zeroForOne, uint256 amountIn, uint256 minAmountOut, bytes routeData) swapData, address receiver) external payable returns (uint256 amount0, uint256 amount1, uint256 mintAmount)',
  'function addLiquidityNative(address island, uint256 amount0Max, uint256 amount1Max, uint256 amount0Min, uint256 amount1Min, uint256 amountSharesMin, address receiver) external payable returns (uint256 amount0, uint256 amount1, uint256 mintAmount)'
];

// Island ABI for getting information about the island
const ISLAND_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getUnderlyingBalances() external view returns (uint256 amount0Current, uint256 amount1Current)',
  'function getMintAmounts(uint256 amount0Max, uint256 amount1Max) external view returns (uint256 amount0, uint256 amount1, uint256 mintAmount)'
];

/**
 * Example of a direct investment using a private key
 * This is for testing purposes only
 */
async function main() {
  try {
    console.log('Starting Kodiak Island investment test script...');
    
    // Initialize provider for Bepolia
    const provider = new ethers.JsonRpcProvider(BepoliaConfig.rpcUrl);
    console.log(`Connected to Bepolia network at ${BepoliaConfig.rpcUrl}`);
    
    // Use private key for testing (in production, use Privy)
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Using wallet address: ${wallet.address}`);
    
    // Get wallet balance to verify we have enough BERA
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} BERA`);
    
    // Amount to invest (in BERA) - test with a small amount
    const investAmount = ethers.parseEther('0.001'); // 0.001 BERA for testing
    
    if (balance <= investAmount) {
      throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(investAmount)} BERA`);
    }
    
    console.log(`Planning to invest: ${ethers.formatEther(investAmount)} BERA`);
    
    // Create router and island contract instances
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const island = new ethers.Contract(ISLAND_ADDRESS, ISLAND_ABI, provider);
    
    // Determine token addresses
    const token0Address = await island.token0();
    const token1Address = await island.token1();
    console.log(`Island tokens: token0=${token0Address}, token1=${token1Address}`);
    
    // Get the current balance ratio to determine the swap parameters
    // Based on "Understanding Token Deposit Ratio" guide
    console.log('Calculating optimal swap parameters...');
    
    // 1. Get current balances
    const balances = await island.getUnderlyingBalances();
    console.log(`Island current balances: token0=${balances[0]}, token1=${balances[1]}`);
    
    // 2. Get mint amounts for a small test deposit to determine ratio
    const testAmount = ethers.parseEther('1'); // 1 unit of each token for ratio calculation
    const mintAmounts = await island.getMintAmounts(testAmount, testAmount);
    const amount0Used = mintAmounts[0];
    const amount1Used = mintAmounts[1];
    
    console.log(`Deposit ratio: token0=${amount0Used}, token1=${amount1Used}`);
    
    // 3. Calculate normalized ratio (this is simplified and should be improved in production)
    const ratio0 = Number(amount0Used) / (Number(amount0Used) + Number(amount1Used));
    const ratio1 = 1 - ratio0;
    console.log(`Normalized ratio: token0=${ratio0 * 100}%, token1=${ratio1 * 100}%`);
    
    // 4. Calculate swap amount using the helper function
    // For single-sided deposit with token0 (WBERA), we calculate how much to swap
    const investAmountStr = investAmount.toString();
    const swapResult = calculateSwapAmount(
      investAmountStr, // All our BERA will be token0
      '0', // We have 0 token1 initially
      ratio0, 
      ratio1
    );
    
    console.log(`Swap calculation result:`, swapResult);
    
    // 5. Prepare swap data
    const swapData = {
      zeroForOne: swapResult.zeroForOne, // From calculation
      amountIn: swapResult.swapAmount, // From calculation
      minAmountOut: calculateMinimumWithSlippage(swapResult.swapAmount, 1), // 1% slippage
      routeData: '0x' // For testnet simple swap
    };
    
    // Set slippage tolerance to 1% (100 basis points)
    const slippageBPS = 100;
    
    // Set minimum shares to receive - in production this should be calculated
    // based on expected output after simulation
    const minShares = ethers.parseEther('0.000001');
    
    console.log('Preparing transaction...');
    console.log('Swap data:', {
      zeroForOne: swapData.zeroForOne,
      amountIn: ethers.formatEther(swapData.amountIn),
      minAmountOut: ethers.formatEther(swapData.minAmountOut)
    });
    
    // Estimate gas
    const gasEstimate = await router.addLiquiditySingleNative.estimateGas(
      ISLAND_ADDRESS,
      minShares,
      slippageBPS,
      swapData,
      wallet.address,
      { value: investAmount }
    );
    
    console.log(`Estimated gas: ${gasEstimate}`);
    
    // Execute transaction
    console.log('Executing transaction...');
    const tx = await router.addLiquiditySingleNative(
      ISLAND_ADDRESS,
      minShares,
      slippageBPS,
      swapData,
      wallet.address,
      { 
        value: investAmount,
        gasLimit: Math.floor(Number(gasEstimate) * 1.2) // Add 20% buffer for gas
      }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Transaction has been submitted! Check the following transaction hash on a block explorer:');
    console.log(`https://testnet-explorer.berachain.com/tx/${tx.hash}`);
    console.log('Investment process started successfully!');
    
  } catch (error) {
    console.error('Error executing investment:', error);
  }
}

/**
 * Example of how to use Privy for signing transactions
 * This demonstrates how to use the island-manager helper functions
 */
async function executeWithPrivy() {
  try {
    // Initialize Privy client
    const privyClient = new PrivyClient({
      appId: process.env.PRIVY_APP_ID!,
      appSecret: process.env.PRIVY_APP_SECRET!,
    });
    
    // In a real implementation, you'd get this from the user's session
    const userPrivyId = process.env.TEST_PRIVY_USER_ID;
    const userAddress = 'USER_ADDRESS_HERE'; // This would come from Privy or your user data
    
    if (!userPrivyId) {
      throw new Error('TEST_PRIVY_USER_ID environment variable not set');
    }
    
    // Amount to invest (in BERA)
    const investAmount = ethers.parseEther('0.001').toString();
    
    // Use the island-manager to generate the transaction data
    // This handles the calculation of proper swap amounts and slippage
    const txData = generateSingleSidedDepositTx({
      islandAddress: ISLAND_ADDRESS,
      tokenAmount: investAmount,
      isToken0: true, // WBERA is token0 in this pool
      slippagePercentage: 0.5, // 0.5% slippage
      receiver: userAddress,
      network: 'bepolia'
    });
    
    console.log('Generated transaction data:', txData);
    console.log('Transaction would be sent with Privy in production');
    
  } catch (error) {
    console.error('Error in Privy execution:', error);
  }
}

// For testing, use the direct method
main().catch(console.error);

// To test with Privy (uncomment when ready)
// executeWithPrivy().catch(console.error); 
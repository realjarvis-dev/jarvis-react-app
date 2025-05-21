import { ethers } from 'ethers';
import { BepoliaConfig } from '../config/network';
import { getKodiakIslandByAddress } from '../lib/kodiak/api';
import {
    generateSingleSidedDepositTx
} from '../lib/kodiak/island-manager';

// ABI for ERC20 tokens
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// ABI for WBERA (Wrapped BERA)
const WBERA_ABI = [
  'function deposit() payable',
  'function withdraw(uint wad)'
];

// Bera Swap Router ABI (simplified for the function we need)
const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
];

// Testnet addresses
const WBERA_ADDRESS = '0x68258aD646D6D7392C8CCa05C00aa1bB1C4a091B';
const ROUTER_ADDRESS = '0x0CBefE45202008Ae2C8F0876604F7AB95bd02D6e'; // Honeycomb testnet router
const TARGET_ISLAND = '0x203eFDe0a9be708A5912fA33612BF1062d370f75'; // WBERA-HONEY island

async function main() {
  // Command line args
  const args = process.argv.slice(2);
  const depositAmount = args[0] || '0.1'; // Default to 0.1 BERA if not specified
  
  // Get private key from environment variables
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY environment variable');
  }

  console.log('Connecting to Bepolia testnet...');
  const provider = new ethers.JsonRpcProvider(BepoliaConfig.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const walletAddress = await wallet.getAddress();
  console.log(`Connected with wallet: ${walletAddress}`);
  
  // Check native BERA balance
  const beraBalance = await provider.getBalance(walletAddress);
  console.log(`Your BERA balance: ${ethers.formatEther(beraBalance)}`);
  
  // Check if user has enough BERA
  const depositAmountWei = ethers.parseEther(depositAmount);
  if (beraBalance < depositAmountWei) {
    throw new Error(`Insufficient BERA balance. You have ${ethers.formatEther(beraBalance)} BERA, but trying to deposit ${depositAmount} BERA.`);
  }

  // Get details about the target island
  console.log(`Fetching information about island ${TARGET_ISLAND}...`);
  const island = await getKodiakIslandByAddress(TARGET_ISLAND, 'bepolia');
  if (!island) {
    throw new Error(`Could not find island ${TARGET_ISLAND}`);
  }

  console.log(`Found island: ${island.name}`);
  console.log(`Token0: ${island.token0.symbol} (${island.token0.address})`);
  console.log(`Token1: ${island.token1.symbol} (${island.token1.address})`);
  console.log(`TVL: ${island.tvl.token0Amount} ${island.token0.symbol} + ${island.tvl.token1Amount} ${island.token1.symbol}`);

  // Initialize contracts
  const wbera = new ethers.Contract(WBERA_ADDRESS, WBERA_ABI, wallet);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  
  // 1. Wrap BERA to WBERA (This is the token we'll use for single-sided deposit)
  console.log(`Wrapping ${depositAmount} BERA to WBERA...`);
  const wrapTx = await wbera.deposit({ value: depositAmountWei });
  await wrapTx.wait();
  console.log(`Successfully wrapped ${depositAmount} BERA to WBERA`);
  
  // 2. Approve the island to use our WBERA
  console.log('Approving WBERA for the island...');
  const wberaToken = new ethers.Contract(WBERA_ADDRESS, ERC20_ABI, wallet);
  const wberaAllowance = await wberaToken.allowance(walletAddress, TARGET_ISLAND);
  
  if (wberaAllowance < depositAmountWei) {
    const approveTx = await wberaToken.approve(TARGET_ISLAND, depositAmountWei);
    await approveTx.wait();
    console.log('WBERA approved!');
  } else {
    console.log('WBERA already approved.');
  }
  
  // 3. Generate single-sided deposit transaction
  console.log('Generating deposit transaction...');
  
  // Determine which token is WBERA (should be token0 based on the island info)
  const isToken0 = island.token0.address.toLowerCase() === WBERA_ADDRESS.toLowerCase();
  
  const tx = generateSingleSidedDepositTx({
    islandAddress: TARGET_ISLAND,
    tokenAmount: depositAmountWei.toString(),
    isToken0: isToken0,
    slippagePercentage: 1.0, // 1% slippage
    network: 'bepolia'
  });
  
  // 4. Execute the transaction
  console.log('Sending deposit transaction...');
  
  try {
    const gasEstimate = await provider.estimateGas({
      to: tx.to,
      data: tx.data,
      from: walletAddress
    });
    
    console.log(`Estimated gas: ${gasEstimate}`);
    
    const txResponse = await wallet.sendTransaction({
      to: tx.to,
      data: tx.data,
      gasLimit: gasEstimate * 120n / 100n // Add 20% buffer to gas estimate
    });
    
    console.log(`Transaction sent! Hash: ${txResponse.hash}`);
    console.log(`Explorer link: ${BepoliaConfig.blockExplorerUrl}/tx/${txResponse.hash}`);
    console.log('Waiting for transaction confirmation...');
    
    const receipt = await txResponse.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log('Deposit successful!');
  } catch (error) {
    console.error('Error during transaction:');
    console.error(error);
    console.log('Transaction failed. Please check the error message above.');
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  }); 
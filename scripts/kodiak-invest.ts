#!/usr/bin/env ts-node
import { ethers } from 'ethers';
import { BepoliaConfig, BerachainMainnetConfig } from '../config/network';
import { getKodiakIslandByAddress } from '../lib/kodiak/api';
import {
    generateDepositTx,
    generateSingleSidedDepositTx,
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

// Default testnet WBERA Address
const WBERA_ADDRESS = '0x68258aD646D6D7392C8CCa05C00aa1bB1C4a091B';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';

// Function to show help message
function showHelp() {
  console.log(`
Kodiak Island Investment Script

Usage:
  npx ts-node scripts/kodiak-invest.ts [command] [options]

Commands:
  deposit [islandAddress] [amount0] [amount1]  - Deposit with both tokens of the pair
  single [islandAddress] [token] [amount]      - Make a single-sided deposit with one token
  wrap [islandAddress] [amount]                - Wrap BERA and deposit into an island
  info [islandAddress]                         - Show information about an island
  help                                         - Show this help message

Options:
  --mainnet                                    - Use mainnet instead of testnet
  --verbose                                    - Show verbose output

Examples:
  npx ts-node scripts/kodiak-invest.ts deposit 0x203eFDe0a9be708A5912fA33612BF1062d370f75 0.1 0.1
  npx ts-node scripts/kodiak-invest.ts single 0x203eFDe0a9be708A5912fA33612BF1062d370f75 WBERA 0.5
  npx ts-node scripts/kodiak-invest.ts wrap 0x203eFDe0a9be708A5912fA33612BF1062d370f75 0.2
  npx ts-node scripts/kodiak-invest.ts info 0x203eFDe0a9be708A5912fA33612BF1062d370f75
  `);
}

// Main function
async function main() {
  // Check for help command
  if (command === 'help') {
    showHelp();
    return;
  }
  
  // Parse options
  const useMainnet = args.includes('--mainnet');
  const verbose = args.includes('--verbose');
  const network = useMainnet ? 'mainnet' : 'bepolia';
  const networkConfig = useMainnet ? BerachainMainnetConfig : BepoliaConfig;
  
  // Remove options from args array
  const filteredArgs = args.filter(arg => !arg.startsWith('--'));
  
  // Get private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY environment variable');
  }

  // Set up provider and wallet
  if (verbose) console.log(`Connecting to ${network}...`);
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const walletAddress = await wallet.getAddress();
  
  if (verbose) console.log(`Connected with wallet: ${walletAddress}`);
  
  // Get island address (required for all commands except help)
  const islandAddress = filteredArgs[1];
  if (!islandAddress) {
    console.error('Error: Island address is required');
    showHelp();
    return;
  }
  
  // Get island information
  if (verbose) console.log(`Fetching information about island ${islandAddress}...`);
  const island = await getKodiakIslandByAddress(islandAddress, network);
  if (!island) {
    throw new Error(`Could not find island ${islandAddress}`);
  }
  
  // Process different commands
  switch (filteredArgs[0]) {
    case 'info':
      await showIslandInfo(island, wallet, walletAddress);
      break;
      
    case 'deposit':
      // Two-token deposit
      const amount0 = filteredArgs[2] || '0.1';
      const amount1 = filteredArgs[3] || '0.1';
      await depositWithBothTokens(island, wallet, walletAddress, amount0, amount1, network);
      break;
      
    case 'single':
      // Single-sided deposit
      const tokenSymbol = filteredArgs[2] || island.token0.symbol;
      const amount = filteredArgs[3] || '0.1';
      await singleSidedDeposit(island, wallet, walletAddress, tokenSymbol, amount, network);
      break;
      
    case 'wrap':
      // Wrap BERA and deposit
      const beraAmount = filteredArgs[2] || '0.1';
      await wrapAndDeposit(island, wallet, walletAddress, beraAmount, network);
      break;
      
    default:
      console.error(`Unknown command: ${filteredArgs[0]}`);
      showHelp();
  }
}

// Show information about an island
async function showIslandInfo(island: any, wallet: ethers.Wallet, walletAddress: string) {
  console.log(`\nIsland Information:`);
  console.log(`Name: ${island.name}`);
  console.log(`Address: ${island.address}`);
  console.log(`Token0: ${island.token0.symbol} (${island.token0.address})`);
  console.log(`Token1: ${island.token1.symbol} (${island.token1.address})`);
  console.log(`TVL: ${island.tvl.token0Amount} ${island.token0.symbol} + ${island.tvl.token1Amount} ${island.token1.symbol}`);
  
  if (island.apr.combinedApr) {
    console.log(`APR: ${island.apr.combinedApr.toFixed(2)}%`);
  } else {
    console.log(`APR: Not available`);
  }
  
  console.log(`Managed: ${island.isManaged ? 'Yes' : 'No'}`);
  if (island.isManaged) {
    console.log(`Manager: ${island.manager}`);
    console.log(`Manager Fee: ${island.managerFeeBPS / 100}%`);
  }
  
  // Check user's balances
  const token0 = new ethers.Contract(island.token0.address, ERC20_ABI, wallet);
  const token1 = new ethers.Contract(island.token1.address, ERC20_ABI, wallet);
  
  const token0Balance = await token0.balanceOf(walletAddress);
  const token1Balance = await token1.balanceOf(walletAddress);
  
  console.log(`\nYour Balances:`);
  console.log(`${island.token0.symbol}: ${ethers.formatUnits(token0Balance, island.token0.decimals)}`);
  console.log(`${island.token1.symbol}: ${ethers.formatUnits(token1Balance, island.token1.decimals)}`);
  console.log(`BERA: ${ethers.formatEther(await wallet.provider.getBalance(walletAddress))}`);
}

// Deposit with both tokens
async function depositWithBothTokens(
  island: any, 
  wallet: ethers.Wallet, 
  walletAddress: string, 
  amount0: string, 
  amount1: string, 
  network: 'bepolia' | 'mainnet'
) {
  console.log(`\nDepositing with both tokens (${island.token0.symbol} and ${island.token1.symbol})...`);
  
  // Create token contracts
  const token0 = new ethers.Contract(island.token0.address, ERC20_ABI, wallet);
  const token1 = new ethers.Contract(island.token1.address, ERC20_ABI, wallet);
  
  // Convert amounts to wei
  const amount0Wei = ethers.parseUnits(amount0, island.token0.decimals);
  const amount1Wei = ethers.parseUnits(amount1, island.token1.decimals);
  
  // Check token balances
  const token0Balance = await token0.balanceOf(walletAddress);
  const token1Balance = await token1.balanceOf(walletAddress);
  
  if (token0Balance < amount0Wei) {
    throw new Error(`Insufficient ${island.token0.symbol} balance. You have ${ethers.formatUnits(token0Balance, island.token0.decimals)}, but trying to deposit ${amount0}`);
  }
  
  if (token1Balance < amount1Wei) {
    throw new Error(`Insufficient ${island.token1.symbol} balance. You have ${ethers.formatUnits(token1Balance, island.token1.decimals)}, but trying to deposit ${amount1}`);
  }
  
  // Approve tokens
  await ensureApproval(token0, amount0Wei.toString(), island.address, walletAddress);
  await ensureApproval(token1, amount1Wei.toString(), island.address, walletAddress);
  
  // Generate transaction
  const tx = generateDepositTx({
    islandAddress: island.address,
    amount0: amount0Wei.toString(),
    amount1: amount1Wei.toString(),
    slippagePercentage: 1.0, // 1% slippage
    network
  });
  
  // Execute transaction
  await executeTransaction(tx, wallet, walletAddress, network);
}

// Single-sided deposit
async function singleSidedDeposit(
  island: any, 
  wallet: ethers.Wallet, 
  walletAddress: string, 
  tokenSymbol: string, 
  amount: string, 
  network: 'bepolia' | 'mainnet'
) {
  console.log(`\nMaking a single-sided deposit with ${tokenSymbol}...`);
  
  // Determine which token to use
  const isToken0 = tokenSymbol.toUpperCase() === island.token0.symbol.toUpperCase();
  const isToken1 = tokenSymbol.toUpperCase() === island.token1.symbol.toUpperCase();
  
  if (!isToken0 && !isToken1) {
    throw new Error(`Token ${tokenSymbol} is not part of this island. You must use ${island.token0.symbol} or ${island.token1.symbol}`);
  }
  
  const token = isToken0 ? 
    new ethers.Contract(island.token0.address, ERC20_ABI, wallet) : 
    new ethers.Contract(island.token1.address, ERC20_ABI, wallet);
  
  const tokenDecimals = isToken0 ? island.token0.decimals : island.token1.decimals;
  
  // Convert amount to wei
  const amountWei = ethers.parseUnits(amount, tokenDecimals);
  
  // Check token balance
  const tokenBalance = await token.balanceOf(walletAddress);
  
  if (tokenBalance < amountWei) {
    throw new Error(`Insufficient ${tokenSymbol} balance. You have ${ethers.formatUnits(tokenBalance, tokenDecimals)}, but trying to deposit ${amount}`);
  }
  
  // Approve token
  await ensureApproval(token, amountWei.toString(), island.address, walletAddress);
  
  // Generate transaction
  const tx = generateSingleSidedDepositTx({
    islandAddress: island.address,
    tokenAmount: amountWei.toString(),
    isToken0,
    slippagePercentage: 1.0, // 1% slippage
    network
  });
  
  // Execute transaction
  await executeTransaction(tx, wallet, walletAddress, network);
}

// Wrap BERA and deposit
async function wrapAndDeposit(
  island: any, 
  wallet: ethers.Wallet, 
  walletAddress: string, 
  beraAmount: string, 
  network: 'bepolia' | 'mainnet'
) {
  console.log(`\nWrapping ${beraAmount} BERA and depositing into island...`);
  
  // Convert amount to wei
  const beraAmountWei = ethers.parseEther(beraAmount);
  
  // Check BERA balance
  const beraBalance = await wallet.provider.getBalance(walletAddress);
  
  if (beraBalance < beraAmountWei) {
    throw new Error(`Insufficient BERA balance. You have ${ethers.formatEther(beraBalance)}, but trying to deposit ${beraAmount}`);
  }
  
  // Use default WBERA address if needed
  const wberaAddress = (network === 'bepolia') ? WBERA_ADDRESS : (
    (island.token0.symbol === 'WBERA') ? island.token0.address :
    (island.token1.symbol === 'WBERA') ? island.token1.address :
    WBERA_ADDRESS
  );
  
  // Create WBERA contract
  const wbera = new ethers.Contract(wberaAddress, WBERA_ABI, wallet);
  
  // Wrap BERA
  console.log(`Wrapping ${beraAmount} BERA to WBERA...`);
  const wrapTx = await wbera.deposit({ value: beraAmountWei });
  await wrapTx.wait();
  console.log(`Successfully wrapped ${beraAmount} BERA to WBERA`);
  
  // Approve WBERA
  const wberaToken = new ethers.Contract(wberaAddress, ERC20_ABI, wallet);
  await ensureApproval(wberaToken, beraAmountWei.toString(), island.address, walletAddress);
  
  // Determine if WBERA is token0 or token1
  const isToken0 = wberaAddress.toLowerCase() === island.token0.address.toLowerCase();
  
  // Generate transaction
  const tx = generateSingleSidedDepositTx({
    islandAddress: island.address,
    tokenAmount: beraAmountWei.toString(),
    isToken0,
    slippagePercentage: 1.0, // 1% slippage
    network
  });
  
  // Execute transaction
  await executeTransaction(tx, wallet, walletAddress, network);
}

// Helper to ensure token approval
async function ensureApproval(tokenContract: ethers.Contract, amount: string, spender: string, walletAddress: string) {
  const symbol = await tokenContract.symbol();
  
  console.log(`Checking approval for ${symbol}...`);
  const allowance = await tokenContract.allowance(walletAddress, spender);
  
  if (allowance < BigInt(amount)) {
    console.log(`Approving ${symbol} for island...`);
    const txApprove = await tokenContract.approve(spender, amount);
    await txApprove.wait();
    console.log(`${symbol} approved!`);
  } else {
    console.log(`${symbol} already approved.`);
  }
}

// Helper to execute a transaction
async function executeTransaction(tx: ethers.TransactionRequest, wallet: ethers.Wallet, walletAddress: string, network: 'bepolia' | 'mainnet') {
  console.log('Sending transaction...');
  
  try {
    const provider = wallet.provider;
    const networkConfig = network === 'bepolia' ? BepoliaConfig : BerachainMainnetConfig;
    
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
    console.log(`Explorer link: ${networkConfig.blockExplorerUrl}/tx/${txResponse.hash}`);
    console.log('Waiting for transaction confirmation...');
    
    const receipt = await txResponse.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
    console.log('Operation successful!');
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
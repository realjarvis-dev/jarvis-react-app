import { ethers } from 'ethers';
import { BepoliaConfig } from '../config/network';
import { getKodiakIslandByAddress } from '../lib/kodiak/api';
import {
    generateDepositTx,
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

// Testnet WBERA Address on Bepolia
const WBERA_ADDRESS = '0x68258aD646D6D7392C8CCa05C00aa1bB1C4a091B';
// Testnet HONEY Address on Bepolia 
const HONEY_ADDRESS = '0x1d6cfDC924F92F629a03B7a8F4c7F39C45DDf08D';

// Target Island to invest in
const TARGET_ISLAND = '0x203eFDe0a9be708A5912fA33612BF1062d370f75';

async function main() {
  // Get private key and provider
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Please set PRIVATE_KEY environment variable');
  }

  console.log('Connecting to Bepolia testnet...');
  const provider = new ethers.JsonRpcProvider(BepoliaConfig.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const walletAddress = await wallet.getAddress();
  console.log(`Connected with wallet: ${walletAddress}`);

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

  // Create token contract instances
  const token0 = new ethers.Contract(island.token0.address, ERC20_ABI, wallet);
  const token1 = new ethers.Contract(island.token1.address, ERC20_ABI, wallet);

  // Check token balances
  const token0Balance = await token0.balanceOf(walletAddress);
  const token1Balance = await token1.balanceOf(walletAddress);
  const token0Symbol = await token0.symbol();
  const token1Symbol = await token1.symbol();
  const token0Decimals = await token0.decimals();
  const token1Decimals = await token1.decimals();

  console.log(`Your balances:`);
  console.log(`${token0Symbol}: ${ethers.formatUnits(token0Balance, token0Decimals)}`);
  console.log(`${token1Symbol}: ${ethers.formatUnits(token1Balance, token1Decimals)}`);

  // Determine deposit scenario based on token balances
  let tx: ethers.TransactionRequest;
  let depositAmount0 = '0';
  let depositAmount1 = '0';
  
  if (token0Balance > 0n && token1Balance > 0n) {
    // Scenario 3: User has both tokens
    console.log('You have both tokens. Proceeding with dual-token deposit.');
    
    // For testing purposes, use a small percentage of available balance
    depositAmount0 = (token0Balance / 10n).toString(); // Use 10% of balance
    depositAmount1 = (token1Balance / 10n).toString(); // Use 10% of balance
    
    console.log(`Depositing ${ethers.formatUnits(depositAmount0, token0Decimals)} ${token0Symbol} and ${ethers.formatUnits(depositAmount1, token1Decimals)} ${token1Symbol}`);
    
    // Check and set approvals
    await ensureApproval(token0, depositAmount0, TARGET_ISLAND, walletAddress);
    await ensureApproval(token1, depositAmount1, TARGET_ISLAND, walletAddress);
    
    // Generate transaction data
    tx = generateDepositTx({
      islandAddress: TARGET_ISLAND,
      amount0: depositAmount0,
      amount1: depositAmount1,
      slippagePercentage: 1.0, // 1% slippage
      network: 'bepolia'
    });
  } else if (token0Balance > 0n) {
    // Scenario 2: User has only token0
    console.log(`You only have ${token0Symbol}. Proceeding with single-token deposit.`);
    
    // For testing purposes, use a small percentage of available balance
    depositAmount0 = (token0Balance / 10n).toString(); // Use 10% of balance
    
    console.log(`Depositing ${ethers.formatUnits(depositAmount0, token0Decimals)} ${token0Symbol}`);
    
    // Check and set approval
    await ensureApproval(token0, depositAmount0, TARGET_ISLAND, walletAddress);
    
    // Generate transaction data for single-sided deposit
    tx = generateSingleSidedDepositTx({
      islandAddress: TARGET_ISLAND,
      tokenAmount: depositAmount0,
      isToken0: true,
      slippagePercentage: 1.0, // 1% slippage
      network: 'bepolia'
    });
  } else if (token1Balance > 0n) {
    // Scenario 2: User has only token1
    console.log(`You only have ${token1Symbol}. Proceeding with single-token deposit.`);
    
    // For testing purposes, use a small percentage of available balance
    depositAmount1 = (token1Balance / 10n).toString(); // Use 10% of balance
    
    console.log(`Depositing ${ethers.formatUnits(depositAmount1, token1Decimals)} ${token1Symbol}`);
    
    // Check and set approval
    await ensureApproval(token1, depositAmount1, TARGET_ISLAND, walletAddress);
    
    // Generate transaction data for single-sided deposit
    tx = generateSingleSidedDepositTx({
      islandAddress: TARGET_ISLAND,
      tokenAmount: depositAmount1,
      isToken0: false,
      slippagePercentage: 1.0, // 1% slippage
      network: 'bepolia'
    });
  } else {
    // Scenario 1: User has neither token
    console.log('You don\'t have any of the required tokens.');
    console.log('For testnet, you can get WBERA by wrapping BERA, and HONEY from a testnet faucet.');
    console.log('Exiting...');
    return;
  }

  // Execute transaction
  console.log('Sending transaction...');
  
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

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  }); 
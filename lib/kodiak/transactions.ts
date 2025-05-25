import { ethers } from 'ethers';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BerachainMainnetConfig } from '../config/network';
import { getUserWallet, privy } from '../privy/client';
import { DepositResult, IslandSingleDepositParams, KodiakQuoteResult, SwapCalculationResult } from '../types/kodiak';

import KodiakRouterJson from './KodiakRouter.json';
const kodiakAbi = KodiakRouterJson as any; 
const ISLAND_ROUTER = "0x679a7C63FC83b6A4D9C1F931891d705483d4791F";

// ABI for the Kodiak Island Router
const KODIAK_ROUTER_ABI = [
  'function addLiquiditySingle(address island, uint256 totalAmountIn, uint256 amountSharesMin, uint256 maxStakingSlippageBPS, tuple(uint256 amountIn,uint256 minAmountOut,bool zeroForOne, bytes routeData) swapData,address receiver) external returns (uint256 amount0,uint256 amount1,uint256 mintAmount)'
];

// ABI for ERC20 tokens for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

// Address of the Kodiak Island Router
const KODIAK_ROUTER_ADDRESS = '0x679a7C63FC83b6A4D9C1F931891d705483d4791F';

/**
 * Approve token spending for the router
 */
export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  wallet: any,
  userAddress: string
): Promise<DepositResult> {
  try {
    // Get current allowance
    const provider = new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(userAddress, spenderAddress);
    
    // Skip approval if allowance is sufficient
    if (allowance >= BigInt(amount)) {
      return { status: 'success' };
    }
    
    // Generate approval transaction
    const approvalData = tokenContract.interface.encodeFunctionData('approve', [
      spenderAddress,
      amount
    ]);
    
    const idempotencyKey = uuidv4();
    
    try {
      const block = await provider.getBlock('latest')
      const baseFee = block?.baseFeePerGas
      console.log('baseFee', baseFee)
      const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044) // ~2× base fee
      const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip

      console.log('Sending transaction...')

      const evmWallet = await getUserWallet('ethereum')
      if (!evmWallet) {
        throw new Error('EVM wallet not found')
      }
      if (!evmWallet.id) {
        throw new Error('EVM wallet ID not found')
      }
      const correctNonce = await provider.getTransactionCount(userAddress as `0x${string}`, "pending");

      // Gas estimation
      const gasEstimate = await provider.estimateGas({
        to: tokenAddress as `0x${string}`,
        from: userAddress as `0x${string}`,
        data: approvalData as `0x${string}`,
        value: BigInt(0)
      })
      // Add a 20 % buffer
      const gasLimit = gasEstimate + gasEstimate / BigInt(5)

      // Send approval transaction using Privy
      const { signedTransaction, encoding } = await privy.walletApi.ethereum.signTransaction({
        walletId: wallet.id,
        transaction: {
          to: tokenAddress as `0x${string}`,
          data: approvalData as `0x${string}`,
          chainId: BerachainMainnetConfig.chainId,
          gasLimit: ethers.toQuantity(gasLimit) as `0x${string}`,
          maxFeePerGas: ethers.toQuantity(maxFee + priority) as `0x${string}`,
          maxPriorityFeePerGas: ethers.toQuantity(priority) as `0x${string}`,
          nonce: correctNonce
        },
        idempotencyKey: idempotencyKey
      });

      // Save the signed transaction to a file for debugging
      try {
        fs.writeFileSync('signed_transaction_approval.json', JSON.stringify({
          signedTransaction,
          encoding,
          txDetails: {
            to: tokenAddress,
            data: approvalData,
            chainId: BerachainMainnetConfig.chainId,
            gasLimit: ethers.toQuantity(gasLimit),
            maxFeePerGas: ethers.toQuantity(maxFee + priority),
            maxPriorityFeePerGas: ethers.toQuantity(priority),
            nonce: correctNonce
          }
        }, null, 2));
        console.log('Approval transaction saved to signed_transaction_approval.json');
      } catch (writeError) {
        console.error('Error saving transaction to file:', writeError);
      }

      // Broadcast the signed transaction
      const txResponse = await provider.broadcastTransaction(signedTransaction)
      
      return { status: 'success', hash: txResponse.hash };
    } catch (txError) {
      throw txError;
    }
  } catch (error) {
    return {
      status: 'fail',
      error_message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute the deposit transaction
 */
export async function executeDeposit(
  swapResult: SwapCalculationResult,
  quoteResult: KodiakQuoteResult,
  params: IslandSingleDepositParams,
  wallet: any,
  userAddress: string,
  totalAmount: bigint
): Promise<DepositResult> {
  try {
    // Log transaction parameters for debugging
    console.log("[Kodiak Deposit] Executing deposit with parameters:", {
      islandAddress: params.islandAddress,
      totalAmount: totalAmount.toString(),
      amountToSwap: swapResult.amountToSwap.toString(),
      amountToKeep: swapResult.amountToKeep.toString(),
      expectedOutput: swapResult.expectedOutput.toString(),
      isToken0: params.isToken0,
      slippageBPS: params.slippageBPS,
      minSharesReceived: params.minSharesReceived
    });
    const provider = new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl);
    // Create RouterSwapParams object
    console.log("quoteResult", quoteResult)

    const slippageFactor = BigInt(10000 - params.slippageBPS) / BigInt(10000);
    const minAmountOut = BigInt(quoteResult.quote) * slippageFactor;
    const swapParams = {
      // zeroForOne should be true if we're swapping token0 for token1
      // This matches the isToken0 flag which indicates if the input token is token0
      amountIn: swapResult.amountToSwap.toString(),
      minAmountOut: minAmountOut.toString(),
      zeroForOne: params.isToken0,
      routeData: quoteResult.methodParameters!.calldata
    };
    
    // Create contract instance
    const kodiakRouter = new ethers.Contract(
      KODIAK_ROUTER_ADDRESS,
      kodiakAbi,
      provider
    );
    
    // For minSharesReceived, we should still parse it with 18 decimals as LP tokens typically use 18 decimals
    const minSharesReceived = ethers.parseUnits(params.minSharesReceived, 18);

    console.log("sending txRequest")
    console.log("params.islandAddress", params.islandAddress)
    const txRequest = await kodiakRouter["addLiquiditySingle"].populateTransaction(
      params.islandAddress,
      totalAmount.toString(),
      minSharesReceived.toString(),
      params.slippageBPS,
      swapParams,
      userAddress // receiver address
    );
    console.log("[txRequest] params.islandAddress", params.islandAddress)

    if (!txRequest.data) {
      throw new Error('Failed to populate transaction request')
    }

    const depositData = txRequest.data
    const idempotencyKey = uuidv4();

    const block = await provider.getBlock('latest')
    const baseFee = block?.baseFeePerGas
    console.log('baseFee', baseFee)
    const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044) // ~2× base fee
    const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip

    console.log('Sending transaction...')

    const evmWallet = await getUserWallet('ethereum')
    if (!evmWallet) {
      throw new Error('EVM wallet not found')
    }
    if (!evmWallet.id) {
      throw new Error('EVM wallet ID not found')
    }
    const correctNonce = await provider.getTransactionCount(userAddress as `0x${string}`, "pending");

    
    try {
      // Send deposit transaction using Privy
      const { encoding, signedTransaction } = await privy.walletApi.ethereum.signTransaction({
        walletId: wallet.id,
        transaction: {
          to: ISLAND_ROUTER as `0x${string}`,
          data: depositData as `0x${string}`,
          chainId: BerachainMainnetConfig.chainId,
          from: userAddress as `0x${string}`,
          gasLimit: 650000,
          maxFeePerGas: ethers.toQuantity(maxFee + priority) as `0x${string}`,
          maxPriorityFeePerGas: ethers.toQuantity(priority) as `0x${string}`,
          nonce: correctNonce,
        },
        idempotencyKey: idempotencyKey
      });

      
      const txResponse = await provider.broadcastTransaction(signedTransaction)
      const receipt = await txResponse.wait()
      if (receipt) {
        console.log('[Kodiak Deposit] Mined in block', receipt.blockNumber)
      }
      console.log("[Kodiak Deposit] Transaction successful with hash:", txResponse.hash);
      return { status: 'success', hash: txResponse.hash };
    } catch (txError) {
      console.error("[Kodiak Deposit] Transaction failed:", txError);
      throw txError;
    }
  } catch (error) {
    return {
      status: 'fail',
      error_message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Calculate minimum amount out with slippage
 * @param quoteAmount The quoted amount from the API
 * @param slippageBPS Slippage in basis points (e.g., 50 for 0.5%)
 * @returns The minimum amount out after applying slippage
 */
export function calculateMinAmountOut(quoteAmount: string, slippageBPS: number): string {
  if (!quoteAmount || isNaN(Number(quoteAmount))) {
    throw new Error(`Invalid quote amount: ${quoteAmount}`);
  }
  
  if (slippageBPS < 0 || slippageBPS > 10000) {
    throw new Error(`Invalid slippage: ${slippageBPS}. Must be between 0 and 10000`);
  }
  
  const amount = BigInt(quoteAmount);
  const minAmountOut = amount - (amount * BigInt(slippageBPS) / BigInt(10000));
  return minAmountOut.toString();
} 
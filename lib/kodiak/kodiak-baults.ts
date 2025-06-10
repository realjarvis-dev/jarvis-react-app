import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { Address, createPublicClient, Hex, http } from "viem";
import { kodiakNodeConfig } from "../network/config";
import { getUserWallet, privy } from '../privy/client';
import {
  BAULT_ABI,
  BOUNTY_HELPER_ABI,
  BOUNTY_HELPER_ADDRESS,
  ERC20_ABI,
  IBGT_ADDRESS
} from "./abi";

// Helper function to create Berachain chain config for viem
// Use Kodiak node for better arbitrage performance
const getBerachainConfig = () => ({
  id: kodiakNodeConfig.chainId,
  name: 'Berachain Mainnet',
  network: 'berachain',
  nativeCurrency: {
    name: 'BERA',
    symbol: 'BERA',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [kodiakNodeConfig.rpcUrl]
    },
    public: {
      http: [kodiakNodeConfig.rpcUrl]
    }
  }
});

// Create public client using kodiakNodeConfig for high-performance arbitrage
const publicClient = createPublicClient({
  chain: getBerachainConfig(),
  transport: http(kodiakNodeConfig.rpcUrl)
});

/**
 * Check a specific Bault's data including bounty, earned BGT, and wrapper amount
 * @param baultAddress The address of the Bault to check
 * @param wrapperAddress The BGT wrapper address to use (defaults to iBGT)
 * @returns Bault data including bounty, earned BGT, and potential wrapper amount
 */
export async function checkBault(
  baultAddress: string, 
  wrapperAddress: Address = IBGT_ADDRESS
) {
  try {
    // Create provider using ethers instead of viem
    const provider = new ethers.JsonRpcProvider(kodiakNodeConfig.rpcUrl);
    
    // Get Bault contract using ethers
    const bault = new ethers.Contract(
      baultAddress,
      BAULT_ABI,
      provider
    );

    // Get current bounty requirement
    const bounty = await bault.bounty() as bigint;

    // Get earned BGT available to claim
    const earnedBGT = await bault.earned() as bigint;

    // Preview how much wrapper we'd get
    const wrapperAmount = await bault.previewClaimBgtWrapper(wrapperAddress) as bigint;

    return { bounty, earnedBGT, wrapperAmount };
  } catch (error) {
    console.error(`Error checking Bault ${baultAddress}:`, error);
    return null;
  }
}

/**
 * Get estimated swap amount using the Enso API
 * @param fromToken The wrapper token address (e.g., iBGT)
 * @param toToken The staking token address
 * @param amount The amount of wrapper tokens to swap
 * @returns Estimated output amount in staking tokens
 */
export async function getEstimatedSwapAmount(
  fromToken: Address, 
  toToken: Address, 
  amount: bigint
): Promise<bigint> {
  try {
    console.log(`Estimating swap amount for ${amount} ${fromToken} to ${toToken}`);
    
    // Use the getSwapQuote function to get a real quote from Enso
    const quote = await getSwapQuote(
      fromToken,
      toToken,
      amount.toString(),
      100 // 1% slippage
    );
    
    // Check if amountOut exists in the quote
    if (!quote.amountOut) {
      throw new Error('Swap quote did not return an amountOut value');
    }
    
    // Log successful quote retrieval
    console.log(`Received swap quote: ${quote.amountOut} output tokens for ${amount} input tokens`);
    
    // Convert the string amount to bigint
    return BigInt(quote.amountOut);
  } catch (error) {
    // Extract error message for detailed logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error estimating swap amount: ${errorMessage}`);
    
    // No fallback - propagate the error
    throw error;
  }
}

/**
 * Get a swap quote from the Enso API
 * @param fromToken The token to swap from (wrapper token)
 * @param toToken The token to swap to (staking token)
 * @param amount The amount to swap
 * @param slippage The slippage tolerance (basis points)
 * @returns Swap quote including amountOut, calldata, and target address
 */
export async function getSwapQuote(
  fromToken: Address, 
  toToken: Address, 
  amount: string, 
  slippage: number = 100
) {
  try {
    // Get user wallet address to use in the API call
    const wallet = await getUserWallet('ethereum');
    if (!wallet || !wallet.address) {
      throw new Error('User wallet not found for swap quote');
    }
    
    const userAddress = wallet.address;
    
    console.log(`Getting swap quote: ${fromToken} -> ${toToken}, amount: ${amount}, using address: ${userAddress}`);
    
    // Use the API key from environment or fall back to the one from user's curl example
    const apiKey = process.env.ENSO_API_KEY || 'a8137bac-1e80-4e8e-aafb-891a53232887';
    console.log(`Using Enso API key: ${apiKey.substring(0, 5)}...`);
    
    // Use Enso API to get an optimal swap route with the correct format that matches the working curl command
    const response = await fetch('https://api.enso.finance/api/v1/shortcuts/route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        chainId: kodiakNodeConfig.chainId,
        fromAddress: userAddress,
        routingStrategy: "router",
        receiver: userAddress,
        spender: userAddress,
        tokenIn: [fromToken],
        tokenOut: [toToken],
        amountIn: [amount],
        slippage: slippage.toString()
      })
    });

    if (!response.ok) {
      // Try to get the response body for more detailed error information
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Could not read error response body';
      }
      
      // Log the detailed error information
      console.error(`Enso API error (${response.status} ${response.statusText}): ${errorBody}`);
      console.error(`Request details: fromToken=${fromToken}, toToken=${toToken}, amount=${amount}, chainId=${kodiakNodeConfig.chainId}`);
      
      // Throw error with more information
      throw new Error(`Enso API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    
    // Debug: Log the full response to understand structure
    console.log('Enso API response successful');
    console.log('Full response structure:', JSON.stringify(data).substring(0, 500) + '...');
    
    // Extract data according to the expected format based on the sample curl response
    if (!data || !data.tx) {
      console.error('Unexpected API response format:', JSON.stringify(data).substring(0, 200) + '...');
      throw new Error('Enso API returned an unexpected response format');
    }
    
    // Fix: Extract amountOut from the correct location in the response
    // Based on the curl example, amountOut is at the root level of the response JSON
    const amountOut = data.amountOut || // Root level (as shown in curl example)
                     data.tx.amountOut || // TX level (just in case)
                     (data.output && data.output[0]) || // Alternative location
                     (data.tx.output && data.tx.output[0]); // Another alternative
                     
    if (!amountOut) {
      console.error('No amountOut found in response. Response data:', JSON.stringify(data).substring(0, 200) + '...');
      throw new Error('No amountOut value in Enso API response');
    }
    
    console.log(`Swap quote details: amountOut=${amountOut}, to=${data.tx.to}`);
    
    // Return the swap quote data with the correctly extracted amountOut
    return {
      amountOut: amountOut,
      calldata: data.tx.data as Hex,
      to: data.tx.to as Address
    };
  } catch (error) {
    console.error("Error getting swap quote from Enso:", error);
    // No fallback - throw the error
    throw error;
  }
}

/**
 * Check if a Bault is profitable to compound
 * @param baultAddress The Bault address
 * @param stakingToken The staking token address
 * @param wrapperAddress The BGT wrapper address to use (defaults to iBGT)
 * @returns Profitability information
 */
export async function checkProfitability(
  baultAddress: string, 
  stakingToken: Address,
  wrapperAddress: Address = IBGT_ADDRESS
) {
  try {
    console.log(`Checking profitability for Bault ${baultAddress} with wrapper ${wrapperAddress}`);
    
    const result = await checkBault(baultAddress, wrapperAddress);
    
    if (!result) {
      console.log(`No result from checkBault for ${baultAddress}`);
      return { 
        isReady: false, 
        bounty: BigInt(0), 
        wrapperAmount: BigInt(0), 
        estimatedOutput: BigInt(0),
        profit: BigInt(0),
        error: "Failed to retrieve Bault data" 
      };
    }
    
    const { bounty, wrapperAmount } = result;
    
    console.log(`Bault ${baultAddress}:
      Bounty required: ${bounty}
      Wrapper amount available: ${wrapperAmount}
    `);
    
    // Check if wrapper amount is too small to even try swapping
    if (wrapperAmount < BigInt(1000)) {
      return {
        isReady: false,
        bounty,
        wrapperAmount,
        estimatedOutput: BigInt(0),
        profit: BigInt(0),
        error: "Wrapper amount too small for meaningful swap"
      };
    }
    
    try {
      // Get estimated swap output using Enso API
      const estimatedOutput = await getEstimatedSwapAmount(
        wrapperAddress,
        stakingToken,
        wrapperAmount
      );
      
      // Check if estimated output covers the bounty
      const isReady = estimatedOutput >= bounty;
      const profit = isReady ? estimatedOutput - bounty : BigInt(0);
      
      // Calculate profit percentage for better user information
      let profitPercentage = 0;
      if (isReady && bounty > 0) {
        profitPercentage = Number((profit * BigInt(10000) / bounty)) / 100;
      }
      
      console.log(`Profitability results:
        Estimated swap output: ${estimatedOutput}
        Bounty required: ${bounty}
        Ready to compound: ${isReady}
        Expected profit: ${profit} staking tokens
        Profit percentage: ${profitPercentage}%
      `);
      
      return { 
        isReady, 
        bounty, 
        wrapperAmount, 
        estimatedOutput,
        profit,
        profitPercentage
      };
    } catch (swapError) {
      // Handle specific error from swap estimation
      const errorMessage = swapError instanceof Error ? swapError.message : String(swapError);
      console.error(`Error estimating swap for profitability check: ${errorMessage}`);
      
      // Return more detailed information to help diagnose the issue
      return {
        isReady: false,
        bounty,
        wrapperAmount,
        estimatedOutput: BigInt(0),
        profit: BigInt(0),
        error: `Failed to estimate swap: ${errorMessage}`,
        errorType: 'swap_estimation'
      };
    }
  } catch (error) {
    console.error(`Error checking profitability for Bault ${baultAddress}:`, error);
    return { 
      isReady: false, 
      bounty: BigInt(0), 
      wrapperAmount: BigInt(0), 
      estimatedOutput: BigInt(0),
      profit: BigInt(0),
      error: error instanceof Error ? error.message : String(error),
      errorType: 'general'
    };
  }
}

/**
 * Execute a compound transaction for a profitable Bault directly (without BountyHelper)
 * Uses Privy wallet integration like in transactions.ts
 * @param baultAddress The address of the Bault to compound
 * @param recipientAddress Address to receive the claimed BGT/wrapper tokens
 * @param useWrapper Whether to claim as wrapped BGT (true) or as BGT (false)
 * @param wrapperAddress The BGT wrapper address to use (defaults to iBGT)
 * @returns Transaction hash
 */
export async function compoundBaultDirect(
  baultAddress: Address, 
  recipientAddress: Address,
  useWrapper: boolean = true,
  wrapperAddress: Address = IBGT_ADDRESS
): Promise<{status: string, hash?: string, error_message?: string}> {
  try {
    // Get user wallet from Privy
    const wallet = await getUserWallet('ethereum');
    if (!wallet || !wallet.address) {
      throw new Error('User wallet not found');
    }
    
    // Check if wallet ID exists
    if (!wallet.id) {
      throw new Error('Wallet ID not found');
    }
    
    const userAddress = wallet.address;
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(kodiakNodeConfig.rpcUrl);
    
    // Get Bault contract
    const bault = new ethers.Contract(
      baultAddress,
      BAULT_ABI,
      provider
    );

    // 1. Get the staking token address
    const stakingTokenAddress = await bault.stakingToken() as Address;
    
    // 2. Get the staking token contract
    const stakingToken = new ethers.Contract(
      stakingTokenAddress,
      ERC20_ABI,
      provider
    );
    
    // 3. Get the bounty amount
    const bountyAmount = await bault.bounty() as bigint;
    
    // 4. Check user balance to make sure they have enough tokens for the bounty
    const userBalance = await stakingToken.balanceOf(userAddress) as bigint;
    if (userBalance < bountyAmount) {
      throw new Error(`Insufficient balance for bounty. Required: ${bountyAmount}, Available: ${userBalance}`);
    }
    
    // 5. Approve the staking token for the Bault
    // First check if allowance is sufficient
    const allowance = await stakingToken.allowance(userAddress, baultAddress);
    
    if (allowance < bountyAmount) {
      // Approve token spending
      const approvalData = stakingToken.interface.encodeFunctionData('approve', [
        baultAddress,
        bountyAmount.toString()
      ]);
      
      const idempotencyKey = uuidv4();
      
      // Get gas settings
      const block = await provider.getBlock('latest');
      const baseFee = block?.baseFeePerGas;
      const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044); // ~2× base fee
      const priority = ethers.parseUnits('1', 'gwei'); // 1 gwei tip
      
      const correctNonce = await provider.getTransactionCount(userAddress as `0x${string}`, "pending");
      
      // Gas estimation for approval
      const gasEstimate = await provider.estimateGas({
        to: stakingTokenAddress as `0x${string}`,
        from: userAddress as `0x${string}`,
        data: approvalData as `0x${string}`,
        value: BigInt(0)
      });
      
      // Add a 20% buffer
      const gasLimit = gasEstimate + gasEstimate / BigInt(5);
      
      // Send approval transaction using Privy
      const { signedTransaction } = await privy.walletApi.ethereum.signTransaction({
        walletId: wallet.id as string,
        transaction: {
          to: stakingTokenAddress as `0x${string}`,
          data: approvalData as `0x${string}`,
          chainId: kodiakNodeConfig.chainId,
          gasLimit: ethers.toQuantity(gasLimit) as `0x${string}`,
          maxFeePerGas: ethers.toQuantity(maxFee + priority) as `0x${string}`,
          maxPriorityFeePerGas: ethers.toQuantity(priority) as `0x${string}`,
          nonce: correctNonce
        },
        idempotencyKey: idempotencyKey
      });
      
      // Broadcast the signed transaction
      const approveTxResponse = await provider.broadcastTransaction(signedTransaction);
      console.log(`Approval transaction sent: ${approveTxResponse.hash}`);
      
      // Wait for approval to be confirmed (in production, you'd wait for the receipt)
      await approveTxResponse.wait();
      console.log(`Approval confirmed`);
    }
    
    // 6. Prepare the claim transaction
    let txData: string;
    let minAmountOut: bigint;
    
    if (useWrapper) {
      // 6a. If using wrapper, get the expected wrapper amount for slippage protection
      const expectedWrapperAmount = await bault.previewClaimBgtWrapper(wrapperAddress) as bigint;
      minAmountOut = expectedWrapperAmount * BigInt(95) / BigInt(100); // 5% slippage
      
      // Prepare claimBgtWrapper transaction
      txData = bault.interface.encodeFunctionData('claimBgtWrapper', [
        wrapperAddress,
        recipientAddress,
        minAmountOut.toString()
      ]);
    } else {
      // 6b. If claiming as BGT, get expected BGT amount
      const expectedBgtAmount = await bault.earned() as bigint;
      minAmountOut = expectedBgtAmount * BigInt(95) / BigInt(100); // 5% slippage
      
      // Prepare claimBgt transaction
      txData = bault.interface.encodeFunctionData('claimBgt', [
        recipientAddress,
        minAmountOut.toString()
      ]);
    }
    
    // 7. Send the claim transaction
    const claimIdempotencyKey = uuidv4();
    const claimNonce = await provider.getTransactionCount(userAddress as `0x${string}`, "pending");
    
    // Gas estimation for claim
    const claimGasEstimate = await provider.estimateGas({
      to: baultAddress as `0x${string}`,
      from: userAddress as `0x${string}`,
      data: txData as `0x${string}`,
      value: BigInt(0)
    });
    
    // Add a 20% buffer
    const claimGasLimit = claimGasEstimate + claimGasEstimate / BigInt(5);
    
    // Get gas settings
    const claimBlock = await provider.getBlock('latest');
    const claimBaseFee = claimBlock?.baseFeePerGas;
    const claimMaxFee = claimBaseFee ? BigInt(claimBaseFee) * BigInt(2) : BigInt(1010690044); // ~2× base fee
    const claimPriority = ethers.parseUnits('1', 'gwei'); // 1 gwei tip
    
    // Send claim transaction using Privy
    const { signedTransaction: signedClaimTx } = await privy.walletApi.ethereum.signTransaction({
      walletId: wallet.id as string,
      transaction: {
        to: baultAddress as `0x${string}`,
        data: txData as `0x${string}`,
        chainId: kodiakNodeConfig.chainId,
        gasLimit: ethers.toQuantity(claimGasLimit) as `0x${string}`,
        maxFeePerGas: ethers.toQuantity(claimMaxFee + claimPriority) as `0x${string}`,
        maxPriorityFeePerGas: ethers.toQuantity(claimPriority) as `0x${string}`,
        nonce: claimNonce
      },
      idempotencyKey: claimIdempotencyKey
    });
    
    // Broadcast the signed transaction
    const txResponse = await provider.broadcastTransaction(signedClaimTx);
    console.log(`Compound transaction sent: ${txResponse.hash}`);
    
    // Wait for transaction confirmation
    await txResponse.wait();
    console.log(`Compound transaction confirmed`);
    
    return { status: 'success', hash: txResponse.hash };
  } catch (error) {
    console.error(`Error compounding Bault ${baultAddress}:`, error);
    return { 
      status: 'fail', 
      error_message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Compound a Bault using the BountyHelper contract (zero-capital compounding)
 * Uses Privy wallet integration like in transactions.ts
 * @param baultAddress The address of the Bault to compound
 * @param wrapperAddress The BGT wrapper address to use
 * @param profitReceiverAddress Address to receive the profit
 * @returns Transaction hash
 */
export async function compoundBaultWithHelper(
  baultAddress: Address,
  wrapperAddress: Address = IBGT_ADDRESS,
  profitReceiverAddress: Address
): Promise<{status: string, hash?: string, error_message?: string}> {
  try {
    // Get user wallet from Privy
    const wallet = await getUserWallet('ethereum');
    if (!wallet || !wallet.address) {
      throw new Error('User wallet not found');
    }
    
    // Check if wallet ID exists
    if (!wallet.id) {
      throw new Error('Wallet ID not found');
    }
    
    const userAddress = wallet.address;
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(kodiakNodeConfig.rpcUrl);
    
    // Get Bault contract
    const bault = new ethers.Contract(
      baultAddress,
      BAULT_ABI,
      provider
    );
    
    // 1. Get the staking token address
    const stakingTokenAddress = await bault.stakingToken() as Address;
    
    // 2. Get the expected wrapper amount
    const wrapperAmount = await bault.previewClaimBgtWrapper(wrapperAddress) as bigint;
    
    // 3. Get swap quote from Enso API
    let quote;
    try {
      quote = await getSwapQuote(
        wrapperAddress,
        stakingTokenAddress, 
        wrapperAmount.toString()
      );
    } catch (swapError) {
      // If we can't get a swap quote, we can't proceed
      const errorMessage = swapError instanceof Error ? swapError.message : String(swapError);
      throw new Error(`Failed to get swap quote: ${errorMessage}`);
    }
    
    // Verify the quote is valid before proceeding
    if (!quote || !quote.to || !quote.calldata) {
      throw new Error("Received an invalid swap quote");
    }
    
    console.log(`Swap quote received from Enso:
      From: ${wrapperAddress} (wrapper)
      To: ${stakingTokenAddress} (staking token)
      Amount In: ${wrapperAmount}
      Expected Out: ${quote.amountOut}
      Router: ${quote.to}
    `);
    
    // 4. Prepare the BountyHelper transaction
    const bountyHelper = new ethers.Contract(
      BOUNTY_HELPER_ADDRESS,
      BOUNTY_HELPER_ABI,
      provider
    );
    
    const txData = bountyHelper.interface.encodeFunctionData('claimBgtWrapper', [
      baultAddress,
      wrapperAddress,
      quote.to,
      quote.calldata,
      wrapperAmount.toString(),
      profitReceiverAddress
    ]);
    
    // 5. Send the transaction using Privy
    const idempotencyKey = uuidv4();
    const nonce = await provider.getTransactionCount(userAddress as `0x${string}`, "pending");
    
    // Gas estimation
    const gasEstimate = await provider.estimateGas({
      to: BOUNTY_HELPER_ADDRESS as `0x${string}`,
      from: userAddress as `0x${string}`,
      data: txData as `0x${string}`,
      value: BigInt(0)
    });
    
    // Add a 20% buffer
    const gasLimit = gasEstimate + gasEstimate / BigInt(5);
    
    // Get gas settings
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas;
    const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044); // ~2× base fee
    const priority = ethers.parseUnits('1', 'gwei'); // 1 gwei tip
    
    // Send transaction using Privy
    const { signedTransaction } = await privy.walletApi.ethereum.signTransaction({
      walletId: wallet.id as string,
      transaction: {
        to: BOUNTY_HELPER_ADDRESS as `0x${string}`,
        data: txData as `0x${string}`,
        chainId: kodiakNodeConfig.chainId,
        gasLimit: ethers.toQuantity(gasLimit) as `0x${string}`,
        maxFeePerGas: ethers.toQuantity(maxFee + priority) as `0x${string}`,
        maxPriorityFeePerGas: ethers.toQuantity(priority) as `0x${string}`,
        nonce: nonce
      },
      idempotencyKey: idempotencyKey
    });
    
    // Broadcast the signed transaction
    const txResponse = await provider.broadcastTransaction(signedTransaction);
    console.log(`Compound transaction sent: ${txResponse.hash}`);
    
    // Wait for transaction confirmation
    await txResponse.wait();
    console.log(`Compound transaction confirmed`);
    
    return { status: 'success', hash: txResponse.hash };
  } catch (error) {
    console.error(`Error compounding Bault with helper ${baultAddress}:`, error);
    return { 
      status: 'fail', 
      error_message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Find the most profitable Bault to compound from a list
 * @param baultList Array of Bault objects with id and stakingToken properties
 * @param wrapperAddress The BGT wrapper address to use
 * @returns The most profitable Bault or null if none are profitable
 */
export async function findMostProfitableBault(
  baultList: Array<{ id: string, stakingToken: string }>,
  wrapperAddress: Address = IBGT_ADDRESS
) {
  let mostProfitableBault = null;
  let highestProfit = BigInt(0);
  
  for (const bault of baultList) {
    const profitability = await checkProfitability(
      bault.id, 
      bault.stakingToken as Address,
      wrapperAddress
    );
    
    if (profitability.isReady && profitability.profit > highestProfit) {
      mostProfitableBault = {
        id: bault.id,
        stakingToken: bault.stakingToken,
        profit: profitability.profit,
        wrapperAmount: profitability.wrapperAmount,
        bounty: profitability.bounty
      };
      highestProfit = profitability.profit;
    }
  }
  
  return mostProfitableBault;
} 
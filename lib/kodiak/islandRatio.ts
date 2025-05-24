import axios from 'axios';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { BerachainMainnetConfig } from '../config/network';
import { getUserEvmWalletAddress, getUserWallet, privy } from '../privy/client';
import { KodiakIsland } from '../types/kodiak';
import { fetchVaultByAddress, mapSubgraphDataToIslands } from './subgraph';

import KodiakRouterJson from './KodiakRouter.json';

const kodiakAbi = KodiakRouterJson as any; 
const ISLAND_ROUTER = "0x679a7C63FC83b6A4D9C1F931891d705483d4791F";

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

// Interface for swap calculation result
interface SwapCalculationResult {
  amountToSwap: bigint;
  amountToKeep: bigint;
  expectedOutput: bigint;
  islandAddress: string;
  tokenInAddress: string;
  tokenOutAddress: string;
}

// Interface for Kodiak Quote API response
interface KodiakQuoteResult {
  blockNumber: string;
  amount: string;
  amountDecimals: string;
  quote: string;
  quoteDecimals: string;
  quoteGasAdjusted: string;
  quoteGasAdjustedDecimals: string;
  gasUseEstimateQuote: string;
  gasUseEstimateQuoteDecimals: string;
  gasUseEstimate: string;
  gasUseEstimateUSD: string;
  gasPriceWei: string;
  route: any[];
  routeString: string;
  quoteId: string;
  methodParameters?: {
    calldata: string;
    value: string;
  };
}

// Interface for deposit parameters
interface DepositParams {
  islandAddress: string;
  totalAmount: string; // Amount in human-readable format
  isToken0: boolean;
  slippageBPS: number; // Slippage in basis points (e.g., 50 for 0.5%)
  minSharesReceived: string; // Minimum shares to receive
}

// Interface for deposit result
interface DepositResult {
  status: 'success' | 'fail';
  hash?: string;
  error_message?: string;
}

// ABI for the Kodiak Island Router
const KODIAK_ROUTER_ABI = [
  // 'function addLiquiditySingle(address island, uint256 totalAmountIn, uint256 amountSharesMin, uint256 maxStakingSlippageBPS, tuple(bool zeroForOne, uint256 amountIn, uint256 minAmountOut, bytes routeData) swapData, address receiver) external returns (uint256 amount0, uint256 amount1, uint256 mintAmount)',
  'function addLiquiditySingle(address island, uint256 totalAmountIn, uint256 amountSharesMin, uint256 maxStakingSlippageBPS, tuple(uint256 amountIn,uint256 minAmountOut,bool zeroForOne, bytes routeData) swapData,address receiver) external returns (uint256 amount0,uint256 amount1,uint256 mintAmount)'
];

// ABI for ERC20 tokens for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

// Address of the Kodiak Island Router
const KODIAK_ROUTER_ADDRESS = '0xe301E48F77963D3F7DbD2a4796962Bd7f3867Fb4';

// Simple ABI for the Island contract's getMintAmounts function
const ISLAND_ABI = [
  'function getMintAmounts(uint256 amount0Max, uint256 amount1Max) external view returns (uint256 amount0, uint256 amount1, uint256 mintAmount)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function name() view returns (string)',
  'function lowerTick() view returns (int24)',
  'function upperTick() view returns (int24)',
  'function pool() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function manager() view returns (address)',
  'function isManaged() view returns (bool)',
  'function managerFeeBPS() view returns (uint16)',
  'function getUnderlyingBalances() view returns (uint256 amount0Current, uint256 amount1Current)'
];

// ABI for pool contract
const POOL_ABI = [
  'function fee() view returns (uint24)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
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
    decimals: Number(decimals),
    symbol
  };
}

/**
 * Calculate the optimal swap amount for single token deposits
 * @param totalAmount The total amount of the input token
 * @param price The price of token0 in terms of token1 (scaled by 10000)
 * @param ratio0 The ratio for token0 needed for deposit
 * @param ratio1 The ratio for token1 needed for deposit
 * @param isToken0 Whether the input token is token0 or token1
 * @returns The amount of input token that should be swapped
 */
function calculateSwapAmount(
  totalAmount: bigint,
  price: bigint,
  ratio0: bigint,
  ratio1: bigint,
  isToken0: boolean
): bigint {
  if (isToken0) {
    const denominator = (ratio0 * price) + (ratio1 * BigInt(10000));
    const amountToKeep = (totalAmount * ratio0 * price) / denominator;
    return totalAmount - amountToKeep;
  } else {
    const denominator = (ratio1 * BigInt(10000)) + (ratio0 * price);
    const amountToKeep = (totalAmount * ratio1 * BigInt(10000)) / denominator;
    return totalAmount - amountToKeep;
  }
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

/**
 * Calculate optimal swap amount for single token deposits based on island ratio
 * @param islandAddress The address of the island contract
 * @param provider The ethers provider
 * @param totalAmount The total amount of token to deposit
 * @param isToken0 Whether the input token is token0 (true) or token1 (false)
 * @returns Object containing the amount to swap, amount to keep, expected output from swap, and token addresses
 */
async function calculateOptimalSwapForIsland(
  islandAddress: string,
  provider: ethers.JsonRpcProvider,
  totalAmount: bigint,
  isToken0: boolean
): Promise<SwapCalculationResult> {
  // Get the island ratio first
  const islandState = await getIslandRatio(islandAddress, provider);
  
  // Get island details to extract the current price
  const islandDetails = await getIslandDetails(islandAddress);
  
  // Require island details and tick to be available
  if (!islandDetails) {
    throw new Error(`Failed to fetch island details for ${islandAddress}`);
  }
  
  if (islandDetails.tick === undefined) {
    throw new Error(`Current tick is not available for island ${islandAddress}`);
  }
  
  // Convert tick to price
  const tickPrice = Math.pow(1.0001, islandDetails.tick);
  // Scale by 10000 to match our ratio calculations
  const price = BigInt(Math.round(tickPrice * 10000));
  
  // Calculate how much to swap
  const amountToSwap = calculateSwapAmount(
    totalAmount,
    price,
    islandState.amount0,
    islandState.amount1,
    isToken0
  );
  
  // Calculate how much of the input token to keep
  const amountToKeep = totalAmount - amountToSwap;
  
  // Calculate expected output from swap
  let expectedOutput: bigint;
  if (isToken0) {
    expectedOutput = (amountToSwap * price) / BigInt(10000);
  } else {
    expectedOutput = (amountToSwap * BigInt(10000)) / price;
  }
  
  // Set token addresses based on isToken0 flag
  const tokenInAddress = isToken0 ? islandDetails.token0.address : islandDetails.token1.address;
  const tokenOutAddress = isToken0 ? islandDetails.token1.address : islandDetails.token0.address;
  
  return {
    amountToSwap,
    amountToKeep,
    expectedOutput,
    islandAddress,
    tokenInAddress,
    tokenOutAddress
  };
}

/**
 * Get details for a specific Kodiak Island by address
 * @param address Island contract address
 * @returns Island details or null if the island doesn't exist
 */
async function getIslandDetails(address: string): Promise<KodiakIsland | null> {
  try {
    // First try to get data from subgraph (more efficient and includes real APR)
    const subgraphData = await fetchVaultByAddress(address);

    if (subgraphData) {
      return mapSubgraphDataToIslands([subgraphData])[0];
    }

    // Fall back to on-chain data if subgraph fails
    const provider = new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl);

    // Create Island contract instance
    const island = new ethers.Contract(address, ISLAND_ABI, provider);

    // Get token addresses directly from the island contract
    const token0Address = await island.token0();
    const token1Address = await island.token1();

    // Get pool address (for fee tier)
    const poolAddress = await island.pool();

    // Get token details
    const token0 = await getTokenInfo(token0Address, provider);
    const token1 = await getTokenInfo(token1Address, provider);

    // Get name directly from the island contract or construct it
    let name;
    try {
      name = await island.name();
    } catch (error) {
      // Fall back to constructed name if name() function fails
      name = `Kodiak Island ${token0.symbol || 'Token0'}-${token1.symbol || 'Token1'}`;
    }

    // Get Island config
    const lowerTick = await island.lowerTick();
    const upperTick = await island.upperTick();
    const manager = await island.manager();

    // Check if island is managed
    const isManaged = await island.isManaged();

    // Get manager fee if managed
    let managerFeeBPS = 0;
    if (isManaged) {
      managerFeeBPS = await island.managerFeeBPS();
    }

    // Get pool fee tier and current tick
    let feeTier = 0; // Default to 0 if not available
    let tick: number | undefined = undefined;
    try {
      const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
      feeTier = Number(await pool.fee());
      
      // Get current tick from pool slot0
      const slot0 = await pool.slot0();
      tick = Number(slot0.tick);
    } catch (error) {
      // Silently fail if pool data can't be fetched
    }

    // Get balances
    const balances = await island.getUnderlyingBalances();

    return {
      address,
      name,
      token0: {
        address: token0Address,
        symbol: token0.symbol || 'Token0',
        decimals: token0.decimals
      },
      token1: {
        address: token1Address,
        symbol: token1.symbol || 'Token1',
        decimals: token1.decimals
      },
      totalSupply: (await island.totalSupply()).toString(),
      lowerTick: Number(lowerTick),
      upperTick: Number(upperTick),
      feeTier,
      manager,
      isManaged,
      managerFeeBPS: Number(managerFeeBPS),
      tvl: {
        token0Amount: balances[0].toString(),
        token1Amount: balances[1].toString(),
        usdValue: 0 // Can't determine USD value from on-chain data
      },
      apr: {
        feeApr: 0,
        combinedApr: 0,
        isEstimate: true // On-chain data doesn't provide APR information
      },
      poolType: 'Island',
      tick
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get the swap calldata from Kodiak Quote API based on the output from calculateOptimalSwapForIsland
 * @param swapResult The result from calculateOptimalSwapForIsland
 * @returns Raw API response 
 * @throws Error if API call fails or returns invalid data
 */
async function getKodiakSwapCalldata(
  swapResult: SwapCalculationResult
): Promise<any> {
  // Constants for the API call
  const CHAIN_ID = BerachainMainnetConfig.chainId;
  const PROTOCOLS = "v2,v3,mixed";
  const TYPE = "exactIn";
  const DEADLINE = "6000";
  const SLIPPAGE_TOLERANCE = "1";
  
  // Get the user's wallet address for the recipient
  const userAddress = await getUserEvmWalletAddress();
  if (!userAddress) {
    throw new Error('Could not get user wallet address');
  }
  const RECIPIENT = userAddress;
  
  // Base URL for the Kodiak Quote API
  const API_URL = "https://api.kodiak.finance/quote";
  
  // Prepare query parameters for the API call
  const params = {
    protocols: PROTOCOLS,
    tokenInAddress: swapResult.tokenInAddress,
    tokenInChainId: CHAIN_ID,
    tokenOutAddress: swapResult.tokenOutAddress,
    tokenOutChainId: CHAIN_ID,
    amount: swapResult.amountToSwap.toString(),
    type: TYPE,
    recipient: RECIPIENT,
    deadline: DEADLINE,
    slippageTolerance: SLIPPAGE_TOLERANCE
  };
  
  try {
    // Make the API call
    const response = await axios.get(API_URL, { params });
    
    // Validate the response data
    const data = response.data;
    if (!data || !data.quote || !data.methodParameters?.calldata) {
      throw new Error('Invalid response from Kodiak API: missing required fields');
    }
    
    // Return the validated response data
    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * Deposit a single token into a Kodiak Island
 * @param params Deposit parameters
 * @returns Result of the deposit operation
 */
async function depositToKodiakIsland(params: DepositParams): Promise<DepositResult> {
  try {
    // Validate input parameters
    if (!params.islandAddress || !ethers.isAddress(params.islandAddress)) {
      return {
        status: 'fail',
        error_message: 'Invalid island address'
      };
    }
    
    if (!params.totalAmount || isNaN(Number(params.totalAmount)) || Number(params.totalAmount) <= 0) {
      return {
        status: 'fail',
        error_message: 'Invalid deposit amount'
      };
    }
    
    if (params.slippageBPS < 0 || params.slippageBPS > 10000) {
      return {
        status: 'fail',
        error_message: 'Invalid slippage: must be between 0 and 10000 BPS'
      };
    }
    
    if (!params.minSharesReceived || isNaN(Number(params.minSharesReceived))) {
      return {
        status: 'fail',
        error_message: 'Invalid minimum shares parameter'
      };
    }
    
    // Get user's wallet
    const wallet = await getUserWallet('ethereum');
    if (!wallet) {
      return {
        status: 'fail',
        error_message: 'No EVM wallet available'
      };
    }
    
    if (!wallet.delegated) {
      return {
        status: 'fail',
        error_message: 'EVM wallet not delegated to Privy'
      };
    }
    
    // Get user's wallet address
    const userAddress = await getUserEvmWalletAddress();
    if (!userAddress) {
      return {
        status: 'fail',
        error_message: 'Could not get user wallet address'
      };
    }
    
    // Set up provider for calculations
    const provider = new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl);
    
    // Get token info from the Island contract
    const islandContract = new ethers.Contract(
      params.islandAddress,
      [
        'function token0() external view returns (address)',
        'function token1() external view returns (address)'
      ],
      provider
    );
    
    const token0Address = await islandContract.token0();
    const token1Address = await islandContract.token1();
    
    // Determine which token is being deposited
    const tokenAddress = params.isToken0 ? token0Address : token1Address;
    
    // Get token decimals
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function decimals() view returns (uint8)'],
      provider
    );
    
    const decimals = await tokenContract.decimals();
    
    // Parse total amount
    const totalAmount = ethers.parseUnits(params.totalAmount, decimals);
    
    // Step 1: Calculate optimal swap
    const swapResult = await calculateOptimalSwapForIsland(
      params.islandAddress,
      provider,
      totalAmount,
      params.isToken0
    );
    
    // Step 2: Get quote and calldata from Kodiak API
    const quoteResult = await getKodiakSwapCalldata(swapResult);
    
    // Check if quote result is valid and contains all required fields
    if (!quoteResult) {
      return {
        status: 'fail',
        error_message: 'Failed to get quote from Kodiak API'
      };
    }
    
    // Check if calldata is present
    if (!quoteResult.methodParameters?.calldata) {
      return {
        status: 'fail',
        error_message: 'Failed to get calldata from Kodiak API'
      };
    }
    
    // Verify that the quote amount is valid
    if (!quoteResult.quote || isNaN(Number(quoteResult.quote)) || Number(quoteResult.quote) <= 0) {
      return {
        status: 'fail',
        error_message: 'Invalid quote amount received from Kodiak API'
      };
    }

    console.log("Start approving")
    
    // Step 3: Approve token spending
    const approvalTx = await approveToken(
      tokenAddress,
      ISLAND_ROUTER,
      totalAmount.toString(),
      wallet,
      userAddress
    );
    
    console.log("end approving")

    if (approvalTx.status === 'fail') {
      return approvalTx;
    }
    console.log("start depositing")
    // Step 4: Execute the deposit transaction
    return await executeDeposit(
      swapResult,
      quoteResult,
      params,
      wallet,
      userAddress,
      totalAmount
    );
    console.log("end depositing")
    
  } catch (error) {
    return {
      status: 'fail',
      error_message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Approve token spending for the router
 */
async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  wallet: any,
  userAddress: string
): Promise<DepositResult> {
  try {
    // Get current allowance
    // const provider = new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl);
    // TODO: only for debugging purpose, change it back later
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
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
    const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip

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
    // Add a 20 % buffer
    const gasLimit = gasEstimate + gasEstimate / BigInt(5)

      // Send approval transaction using Privy
      const { signedTransaction, encoding } = await privy.walletApi.ethereum.signTransaction({
        walletId: wallet.id,
        // caip2: `eip155:${BerachainMainnetConfig.chainId}`,
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


        

        const txResponse = await provider.broadcastTransaction(signedTransaction)
        const receipt = await txResponse.wait()
        console.log("[Approve token] receipt", receipt)
        if (receipt) {
          console.log('[Approve token] Mined in block', receipt.blockNumber)
        }
      
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
async function executeDeposit(
  swapResult: SwapCalculationResult,
  quoteResult: KodiakQuoteResult,
  params: DepositParams,
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
    //TODO: change the url back later. only for debugging purpose
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    // Create RouterSwapParams object
    console.log("quoteResult", quoteResult)
    const swapParams = {
      // zeroForOne should be true if we're swapping token0 for token1
      // This matches the isToken0 flag which indicates if the input token is token0
      amountIn: swapResult.amountToSwap.toString(),
      minAmountOut: calculateMinAmountOut(quoteResult.quote, params.slippageBPS),
      zeroForOne: params.isToken0,
      routeData: quoteResult.methodParameters!.calldata
    };
    
    // Create contract interface for encoding function call
    // const routerInterface = new ethers.Interface(KODIAK_ROUTER_ABI);
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

    // console.log("quote", kodiakRouter.interface.getFunction("addLiquiditySingle")?.inputs);

    // try {
    //   const [amt0, amt1, mintAmt] = await kodiakRouter["addLiquiditySingle"].staticCall(
    //     params.islandAddress,
    //     totalAmount.toString(),
    //     minSharesReceived.toString(),
    //     params.slippageBPS,
    //     swapParams,
    //     userAddress // receiver address
    //   );
    // } catch (error) {
    //   console.error("[Kodiak Deposit] Error in static call:", error);
    //   throw error;
    // }


    if (!txRequest.data) {
      throw new Error('Failed to populate transaction request')
    }

    const depositData = txRequest.data
    const idempotencyKey = uuidv4();



    const block = await provider.getBlock('latest')
    const baseFee = block?.baseFeePerGas
    console.log('baseFee', baseFee)
    const maxFee = baseFee ? BigInt(baseFee) * BigInt(2) : BigInt(1010690044) // ~2× base fee
    const priority = ethers.parseUnits('1', 'gwei') // 1 gwei tip

    console.log('Sending transaction...')


    const evmWallet = await getUserWallet('ethereum')
    if (!evmWallet) {
      throw new Error('EVM wallet not found')
    }
    if (!evmWallet.id) {
      throw new Error('EVM wallet ID not found')
    }
    const correctNonce = await provider.getTransactionCount(userAddress as `0x${string}`, "pending");



    // // Gas estimation
    // const gasEstimate = await provider.estimateGas({
    //   to: KODIAK_ROUTER_ADDRESS as `0x${string}`,
    //   from: userAddress as `0x${string}`,
    //   data: depositData as `0x${string}`,
    //   value: totalAmount
    // })
    // // Add a 20 % buffer
    // const gasLimit = gasEstimate + gasEstimate / BigInt(5)

    
    try {
      // Send deposit transaction using Privy
      const { encoding, signedTransaction } = await privy.walletApi.ethereum.signTransaction({
        walletId: wallet.id,
        // caip2: `eip155:${BerachainMainnetConfig.chainId}`,
        transaction: {
          to: ISLAND_ROUTER as `0x${string}`,
          data: depositData as `0x${string}`,
          chainId: BerachainMainnetConfig.chainId,
          from: userAddress as `0x${string}`,
          gasLimit: 650000,
          // gasLimit: ethers.toQuantity(gasLimit) as `0x${string}`,
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
    // console.error("[Kodiak Deposit] Error in executeDeposit:", error);
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
function calculateMinAmountOut(quoteAmount: string, slippageBPS: number): string {
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

export {
    calculateOptimalSwapForIsland,
    calculateSwapAmount, depositToKodiakIsland, getIslandDetails,
    getIslandRatio,
    getKodiakSwapCalldata
};

// Export types
    export type {
        DepositParams,
        DepositResult,
        IslandState,
        KodiakQuoteResult,
        SwapCalculationResult,
        Token
    };


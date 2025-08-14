import { ethers } from 'ethers';
import { getGasPriceByChainId } from '../blocknative/get-gas-price';
import { getConfigByChainId } from '../network/config';

export interface RobustGasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  totalGasCost: bigint;
  totalGasCostEth: string;
  totalGasCostUsd: string;
  userBalance: bigint;
  userBalanceEth: string;
  userBalanceUsd: string;
  isBalanceSufficient: boolean;
  shortfallEth: string;
  shortfallUsd: string;
  estimationMethod: 'etherscan' | 'blocknative' | 'rpc' | 'fallback' | 'approximate';
  dataSource: string;
  revertReason?: string;
  isForkEnvironment: boolean;
  transactionWouldRevert: boolean;
}

/**
 * Get current ETH price from multiple sources with fallback
 */
async function getCurrentEthPrice(): Promise<number> {
  try {
    // Try CoinGecko first (free, no API key needed)
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum?.usd || 3000; // Fallback to $3000
  } catch (error) {
    console.warn('Failed to fetch ETH price from CoinGecko, using $3000 default');
    return 3000; // Conservative fallback
  }
}

/**
 * Decode contract revert reason from error
 */
function decodeRevertReason(error: any): string | null {
  try {
    // Check for custom error in error message
    if (error.message?.includes('custom error')) {
      const customErrorMatch = error.message.match(/custom error 0x([a-fA-F0-9]+)/);
      if (customErrorMatch) {
        const errorSelector = customErrorMatch[1];
        // Map common Pendle error selectors
        const pendleErrors: Record<string, string> = {
          '72294811': 'Market conditions changed - insufficient liquidity or price impact too high',
          '8756c898': 'Slippage tolerance exceeded - try increasing slippage',
          'a0050bed': 'Token approval or balance insufficient'
        };
        
        const knownError = pendleErrors[errorSelector.substring(0, 8)];
        if (knownError) {
          return knownError;
        }
        return `Contract revert with custom error: 0x${errorSelector}`;
      }
    }
    
    // Check for standard revert reasons
    if (error.reason) return error.reason;
    if (error.message?.includes('revert')) {
      const revertMatch = error.message.match(/revert (.+)/);
      if (revertMatch) return revertMatch[1];
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Detect if we're running on a local fork
 */
function isLocalFork(rpcUrl: string): boolean {
  return rpcUrl.includes('127.0.0.1') || 
         rpcUrl.includes('localhost') || 
         rpcUrl.includes('anvil-fork') ||
         rpcUrl.includes('8545');
}

/**
 * Get fallback gas limit based on transaction complexity
 */
function getFallbackGasLimit(txData: { data: string; value?: string }): bigint {
  const dataLength = txData.data.length;
  const hasValue = txData.value && txData.value !== '0x0' && txData.value !== '0';
  
  // Base gas for simple transfers
  if (dataLength <= 10) {
    return BigInt(21000);
  }
  
  // Complex DeFi transactions (like Pendle swaps)
  if (dataLength > 1000) {
    return hasValue ? BigInt(600000) : BigInt(500000);
  }
  
  // Standard contract interactions
  return hasValue ? BigInt(400000) : BigInt(300000);
}

/**
 * Estimate gas using ethers.js provider directly with enhanced error handling
 */
async function estimateGasWithRpc(
  txData: {
    to: string;
    from: string;
    data: string;
    value?: string;
  },
  chainId: number,
  isDemo: boolean
): Promise<{ gasLimit: bigint; source: string }> {
  const rpcUrl = getConfigByChainId(chainId, isDemo).rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const isFork = isLocalFork(rpcUrl);
  
  try {
    const gasEstimate = await provider.estimateGas({
      to: txData.to,
      from: txData.from,
      data: txData.data,
      value: txData.value || '0x0'
    });
    
    // Add 20% buffer for safety (more for forks due to state differences)
    const bufferMultiplier = isFork ? BigInt(3) : BigInt(5); // 33% for forks, 20% for mainnet
    const gasLimit = gasEstimate + gasEstimate / bufferMultiplier;
    
    const source = isFork ? 'RPC Provider (Fork)' : 'RPC Provider';
    return { gasLimit, source };
  } catch (error: any) {
    const revertReason = decodeRevertReason(error);
    
    if (isFork && revertReason) {
      console.warn(`Fork gas estimation failed with reason: ${revertReason}`);
      // For forks, try to provide a more generous fallback
      const fallbackGas = getFallbackGasLimit(txData);
      const generousFallback = fallbackGas + fallbackGas / BigInt(2); // 50% extra buffer
      
      console.log(`Using generous fork fallback: ${generousFallback.toString()} gas`);
      return { 
        gasLimit: generousFallback, 
        source: `Fork Fallback (${revertReason})` 
      };
    }
    
    const errorMessage = revertReason 
      ? `Transaction would revert: ${revertReason}`
      : `RPC gas estimation failed: ${error.message}`;
    
    throw new Error(errorMessage);
  }
}

/**
 * Get gas price from Blocknative with error handling
 */
async function getGasPriceFromBlocknative(chainId: number): Promise<{ gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; source: string }> {
  try {
    const gasPriceInfo = await getGasPriceByChainId(chainId);
    return {
      maxFeePerGas: gasPriceInfo.maxFeePerGas,
      maxPriorityFeePerGas: gasPriceInfo.maxPriorityFeePerGas,
      source: 'Blocknative API'
    };
  } catch (error: any) {
    throw new Error(`Blocknative gas price failed: ${error.message}`);
  }
}

/**
 * Get gas price from provider's feeData
 */
async function getGasPriceFromProvider(chainId: number, isDemo: boolean): Promise<{ gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; source: string }> {
  const rpcUrl = getConfigByChainId(chainId, isDemo).rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  try {
    const feeData = await provider.getFeeData();
    
    return {
      gasPrice: feeData.gasPrice || undefined,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
      source: 'RPC Provider Fee Data'
    };
  } catch (error: any) {
    throw new Error(`Provider fee data failed: ${error.message}`);
  }
}

/**
 * Fallback gas prices based on current network conditions
 */
function getFallbackGasPrices(chainId: number): { gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; source: string } {
  // Conservative estimates based on recent network conditions
  const fallbackPrices: Record<number, any> = {
    1: { // Ethereum Mainnet
      gasPrice: ethers.parseUnits('15', 'gwei'), // Conservative 15 gwei
      maxFeePerGas: ethers.parseUnits('20', 'gwei'), // 20 gwei max fee
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei') // 2 gwei priority
    },
    42161: { // Arbitrum
      gasPrice: ethers.parseUnits('0.1', 'gwei'),
      maxFeePerGas: ethers.parseUnits('0.2', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('0.01', 'gwei')
    },
    8453: { // Base
      gasPrice: ethers.parseUnits('0.001', 'gwei'),
      maxFeePerGas: ethers.parseUnits('0.002', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('0.0001', 'gwei')
    }
  };

  const prices = fallbackPrices[chainId] || fallbackPrices[1]; // Default to Ethereum prices
  
  return {
    ...prices,
    source: 'Conservative Fallback'
  };
}

/**
 * Robust gas estimation with multiple fallbacks and demo mode handling
 */
export async function robustGasEstimation(
  txData: {
    to: string;
    from: string;
    data: string;
    value?: string;
  },
  chainId: number,
  isDemo: boolean = false
): Promise<RobustGasEstimate> {
  
  console.log('🔍 Starting robust gas estimation...');
  const rpcUrl = getConfigByChainId(chainId, isDemo).rpcUrl;
  const isFork = isLocalFork(rpcUrl);
  
  if (isFork) {
    console.log('🔧 Detected local fork environment, using enhanced fallback strategies');
  }
  
  if (isDemo) {
    console.log('🎭 Demo mode enabled - using educational gas estimation approach');
  }
  
  let gasLimit: bigint;
  let estimationMethod: RobustGasEstimate['estimationMethod'] = 'approximate';
  let gasDataSource = 'Unknown';
  let gasPriceData: any = {};
  let revertReason: string | null = null;
  
  // Step 1: Try to get gas limit with enhanced fork and demo handling
  try {
    const gasResult = await estimateGasWithRpc(txData, chainId, isDemo);
    gasLimit = gasResult.gasLimit;
    estimationMethod = 'rpc';
    gasDataSource = gasResult.source;
    console.log('✅ RPC gas estimation succeeded:', ethers.formatUnits(gasLimit, 0));
  } catch (error: any) {
    console.warn('⚠️ RPC gas estimation failed:', error.message);
    revertReason = decodeRevertReason(error);
    
    if (revertReason) {
      console.log(`📋 Decoded revert reason: ${revertReason}`);
      
      // In demo mode, provide educational context for common Pendle errors
      if (isDemo && revertReason.includes('Market conditions changed')) {
        console.log('🎓 Demo Education: This error typically occurs when:');
        console.log('   - Market liquidity is insufficient for the trade size');
        console.log('   - Price impact would be too high');
        console.log('   - Fork state differs from current mainnet conditions');
      }
    }
    
    // Enhanced fallback logic for different scenarios
    if (txData.data === '0x' || txData.data === '') {
      gasLimit = BigInt(21000); // Simple ETH transfer
      gasDataSource = 'Simple Transfer Fallback';
    } else if (txData.to?.toLowerCase() === '0x888888888889758f76e7103c6cbf23abbf58f946') {
      // Pendle RouterV4 - use generous gas limit for complex swaps
      gasLimit = isFork ? BigInt(800000) : BigInt(600000); // Extra buffer for forks
      gasDataSource = isDemo ? 'Pendle Router Demo Fallback' : 'Pendle Router Fallback';
      console.log('🔄 Detected Pendle RouterV4 transaction, using generous gas limit');
      
      if (isDemo && revertReason) {
        console.log('🎭 Demo mode: Transaction would revert, but providing gas estimation for educational purposes');
      }
    } else if (txData.data.length > 2000) {
      // Very complex transactions (like multi-hop swaps)
      gasLimit = isFork ? BigInt(700000) : BigInt(500000);
      gasDataSource = 'Complex Transaction Fallback';
    } else if (txData.data.length > 1000) {
      // Standard complex DeFi transactions
      gasLimit = isFork ? BigInt(500000) : BigInt(400000);
      gasDataSource = 'DeFi Transaction Fallback';
    } else {
      // Standard contract interactions
      gasLimit = isFork ? BigInt(400000) : BigInt(300000);
      gasDataSource = 'Standard Contract Fallback';
    }
    
    estimationMethod = 'fallback';
    console.log(`⚠️ Using ${gasDataSource}: ${ethers.formatUnits(gasLimit, 0)} gas`);
  }
  
  // Step 2: Try to get gas prices (multiple sources)
  const gasPriceAttempts = [
    () => getGasPriceFromBlocknative(chainId),
    () => getGasPriceFromProvider(chainId, isDemo),
    () => Promise.resolve(getFallbackGasPrices(chainId))
  ];
  
  for (const attempt of gasPriceAttempts) {
    try {
      gasPriceData = await attempt();
      console.log('✅ Gas price obtained from:', gasPriceData.source);
      break;
    } catch (error: any) {
      console.warn('⚠️ Gas price source failed:', error.message);
      continue;
    }
  }
  
  // If everything failed, use absolute fallback
  if (!gasPriceData.source) {
    gasPriceData = getFallbackGasPrices(chainId);
    console.warn('⚠️ Using absolute fallback gas prices');
  }
  
  // Step 3: Calculate total gas cost
  let totalGasCost: bigint;
  if (gasPriceData.maxFeePerGas) {
    // EIP-1559 transaction
    totalGasCost = gasLimit * gasPriceData.maxFeePerGas;
  } else if (gasPriceData.gasPrice) {
    // Legacy transaction
    totalGasCost = gasLimit * gasPriceData.gasPrice;
  } else {
    // Emergency fallback
    totalGasCost = gasLimit * ethers.parseUnits('15', 'gwei');
  }
  
  // Step 4: Get user balance
  let userBalance: bigint;
  try {
    const rpcUrl = getConfigByChainId(chainId, isDemo).rpcUrl;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    userBalance = await provider.getBalance(txData.from);
  } catch (error) {
    console.warn('Failed to get user balance:', error);
    userBalance = BigInt(0); // Conservative fallback
  }
  
  // Step 5: Get current ETH price
  const ethPrice = await getCurrentEthPrice();
  
  // Step 6: Calculate all values
  const transactionValue = BigInt(txData.value || '0');
  const totalRequired = totalGasCost + transactionValue;
  const isBalanceSufficient = userBalance >= totalRequired;
  const shortfall = isBalanceSufficient ? BigInt(0) : totalRequired - userBalance;
  
  const totalGasCostEth = ethers.formatEther(totalGasCost);
  const totalGasCostUsd = (parseFloat(totalGasCostEth) * ethPrice).toFixed(2);
  const userBalanceEth = ethers.formatEther(userBalance);
  const userBalanceUsd = (parseFloat(userBalanceEth) * ethPrice).toFixed(2);
  const shortfallEth = ethers.formatEther(shortfall);
  const shortfallUsd = (parseFloat(shortfallEth) * ethPrice).toFixed(2);
  
  console.log('💰 Gas estimation complete:', {
    gasLimit: ethers.formatUnits(gasLimit, 0),
    totalGasCostEth,
    totalGasCostUsd,
    userBalanceEth,
    isBalanceSufficient,
    source: gasDataSource,
    method: estimationMethod
  });
  
  return {
    gasLimit,
    gasPrice: gasPriceData.gasPrice || BigInt(0),
    maxFeePerGas: gasPriceData.maxFeePerGas,
    maxPriorityFeePerGas: gasPriceData.maxPriorityFeePerGas,
    totalGasCost,
    totalGasCostEth,
    totalGasCostUsd,
    userBalance,
    userBalanceEth,
    userBalanceUsd,
    isBalanceSufficient,
    shortfallEth,
    shortfallUsd,
    estimationMethod,
    dataSource: gasDataSource,
    revertReason: revertReason || undefined,
    isForkEnvironment: isFork,
    transactionWouldRevert: !!revertReason && estimationMethod === 'fallback'
  };
}

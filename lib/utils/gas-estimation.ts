import { ethers } from 'ethers';
import { getGasPriceByChainId } from '../blocknative/get-gas-price';
import { getProposedGasPrice } from '../etherscan/gas-price';
import { getConfigByChainId } from '../network/config';

export interface GasEstimate {
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
  estimationMethod: 'actual' | 'fallback';
}

export interface TransactionPreview {
  transactionValue: bigint;
  transactionValueEth: string;
  gasEstimate: GasEstimate;
  totalRequired: bigint;
  totalRequiredEth: string;
  totalRequiredUsd: string;
  canProceed: boolean;
  warningMessage?: string;
}

/**
 * Get gas price information for a chain
 */
async function getGasPriceInfo(chainId: number) {
  const isLegacyGasModeChain = [56].includes(chainId); // BNB Smart Chain
  
  if (isLegacyGasModeChain) {
    // Legacy gas pricing
    const gasPrice = await getProposedGasPrice(chainId);
    return {
      isLegacy: true,
      gasPrice: ethers.parseUnits(gasPrice.toString(), 'gwei'),
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined
    };
  } else {
    // EIP-1559 gas pricing
    const gasPriceInfo = await getGasPriceByChainId(chainId);
    return {
      isLegacy: false,
      gasPrice: undefined,
      maxFeePerGas: gasPriceInfo.maxFeePerGas,
      maxPriorityFeePerGas: gasPriceInfo.maxPriorityFeePerGas
    };
  }
}

/**
 * Estimate gas cost for a transaction (like MetaMask does)
 */
export async function estimateTransactionGas(
  txData: {
    to: string;
    from: string;
    data: string;
    value?: string;
  },
  chainId: number,
  isDemo: boolean = false
): Promise<GasEstimate> {
  const rpcUrl = getConfigByChainId(chainId, isDemo).rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  let gasLimit: bigint;
  let estimationMethod: 'actual' | 'fallback' = 'actual';
  
  try {
    // Try to estimate gas like MetaMask does
    const gasEstimate = await provider.estimateGas({
      to: txData.to,
      from: txData.from,
      data: txData.data,
      value: txData.value || '0x0'
    });
    
    // Add 20% buffer like we do in actual execution
    gasLimit = gasEstimate + gasEstimate / BigInt(5);
  } catch (error) {
    console.warn('Gas estimation failed, using fallback:', error);
    estimationMethod = 'fallback';
    // Use fallback gas limit
    gasLimit = BigInt(isDemo ? 3000000 : 1000000);
  }
  
  // Get current gas prices
  const gasPriceInfo = await getGasPriceInfo(chainId);
  
  // Calculate total gas cost
  let totalGasCost: bigint;
  if (gasPriceInfo.isLegacy) {
    totalGasCost = gasLimit * gasPriceInfo.gasPrice!;
  } else {
    totalGasCost = gasLimit * gasPriceInfo.maxFeePerGas!;
  }
  
  // Get user balance
  const userBalance = await provider.getBalance(txData.from);
  
  // Calculate USD values (approximate ETH price at $3000)
  const ethPrice = 3000;
  const totalGasCostEth = ethers.formatEther(totalGasCost);
  const totalGasCostUsd = (parseFloat(totalGasCostEth) * ethPrice).toFixed(2);
  const userBalanceEth = ethers.formatEther(userBalance);
  const userBalanceUsd = (parseFloat(userBalanceEth) * ethPrice).toFixed(2);
  
  // Check if balance is sufficient
  const transactionValue = BigInt(txData.value || '0');
  const totalRequired = totalGasCost + transactionValue;
  const isBalanceSufficient = userBalance >= totalRequired;
  
  const shortfall = isBalanceSufficient ? BigInt(0) : totalRequired - userBalance;
  const shortfallEth = ethers.formatEther(shortfall);
  const shortfallUsd = (parseFloat(shortfallEth) * ethPrice).toFixed(2);
  
  return {
    gasLimit,
    gasPrice: gasPriceInfo.gasPrice || BigInt(0),
    maxFeePerGas: gasPriceInfo.maxFeePerGas,
    maxPriorityFeePerGas: gasPriceInfo.maxPriorityFeePerGas,
    totalGasCost,
    totalGasCostEth,
    totalGasCostUsd,
    userBalance,
    userBalanceEth,
    userBalanceUsd,
    isBalanceSufficient,
    shortfallEth,
    shortfallUsd,
    estimationMethod
  };
}

/**
 * Create a transaction preview with gas estimation (like MetaMask transaction preview)
 */
export async function createTransactionPreview(
  txData: {
    to: string;
    from: string;
    data: string;
    value?: string;
  },
  chainId: number,
  isDemo: boolean = false
): Promise<TransactionPreview> {
  const gasEstimate = await estimateTransactionGas(txData, chainId, isDemo);
  
  const transactionValue = BigInt(txData.value || '0');
  const transactionValueEth = ethers.formatEther(transactionValue);
  const totalRequired = gasEstimate.totalGasCost + transactionValue;
  const totalRequiredEth = ethers.formatEther(totalRequired);
  const totalRequiredUsd = (parseFloat(totalRequiredEth) * 3000).toFixed(2);
  
  let warningMessage: string | undefined;
  const canProceed = gasEstimate.isBalanceSufficient;
  
  if (!canProceed) {
    warningMessage = `Insufficient funds. You need ${gasEstimate.shortfallEth} ETH ($${gasEstimate.shortfallUsd}) more to complete this transaction.`;
  } else if (gasEstimate.totalGasCost > gasEstimate.userBalance / BigInt(2)) {
    // Warn if gas cost is more than 50% of balance
    warningMessage = `High gas cost warning: This transaction will cost ${gasEstimate.totalGasCostEth} ETH ($${gasEstimate.totalGasCostUsd}) in gas fees.`;
  }
  
  return {
    transactionValue,
    transactionValueEth,
    gasEstimate,
    totalRequired,
    totalRequiredEth,
    totalRequiredUsd,
    canProceed,
    warningMessage
  };
}

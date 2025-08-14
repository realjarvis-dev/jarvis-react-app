import { ethers } from 'ethers';

export interface DemoTransactionResult {
  hash: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: number;
  from: string;
  to: string;
  value: bigint;
  gasLimit: bigint;
  timestamp: number;
}

export interface DemoFailureExplanation {
  title: string;
  explanation: string;
  suggestions: string[];
  canSimulate: boolean;
  educationalNote: string;
}

/**
 * Generate a realistic-looking demo transaction hash
 */
function generateDemoTxHash(): string {
  const randomBytes = ethers.randomBytes(32);
  return ethers.hexlify(randomBytes);
}

/**
 * Generate a realistic-looking demo block hash
 */
function generateDemoBlockHash(): string {
  const randomBytes = ethers.randomBytes(32);
  return ethers.hexlify(randomBytes);
}

/**
 * Create a simulated successful transaction result for demo purposes
 */
export function createDemoTransactionResult(
  txData: {
    to: string;
    from: string;
    data: string;
    value?: string;
  },
  gasLimit: bigint,
  gasPrice: bigint
): DemoTransactionResult {
  const now = Math.floor(Date.now() / 1000);
  const value = BigInt(txData.value || '0');
  
  // Simulate realistic gas usage (70-90% of gas limit)
  const gasUsagePercent = 0.7 + Math.random() * 0.2; // 70-90%
  const gasUsed = BigInt(Math.floor(Number(gasLimit) * gasUsagePercent));
  
  return {
    hash: generateDemoTxHash(),
    blockNumber: 19000000 + Math.floor(Math.random() * 100000), // Realistic recent block
    blockHash: generateDemoBlockHash(),
    transactionIndex: Math.floor(Math.random() * 200), // Random position in block
    gasUsed,
    effectiveGasPrice: gasPrice,
    status: 1, // Success
    from: txData.from,
    to: txData.to,
    value,
    gasLimit,
    timestamp: now
  };
}

/**
 * Check if a transaction would likely fail based on error patterns
 */
export function wouldTransactionFail(revertReason: string | null): boolean {
  if (!revertReason) return false;
  
  const failurePatterns = [
    'Market conditions changed',
    'insufficient liquidity',
    'price impact too high',
    'Slippage tolerance exceeded',
    'Token approval or balance insufficient'
  ];
  
  return failurePatterns.some(pattern => 
    revertReason.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Get educational explanation for why a transaction would fail
 */
export function getFailureExplanation(revertReason: string): DemoFailureExplanation {
  if (revertReason.includes('Market conditions changed') || revertReason.includes('insufficient liquidity')) {
    return {
      title: 'Market Liquidity Issue',
      explanation: 'This transaction would fail because there isn\'t enough liquidity in the market for your trade size, or the price impact would be too high.',
      suggestions: [
        'Try a smaller trade amount',
        'Use a different token pair with more liquidity',
        'Wait for better market conditions',
        'Check if the market is still active'
      ],
      canSimulate: true,
      educationalNote: 'In a real environment, you would need to adjust your trade parameters or wait for better market conditions. This is a common issue in DeFi when trading large amounts or in low-liquidity markets.'
    };
  }
  
  if (revertReason.includes('Slippage tolerance exceeded')) {
    return {
      title: 'Slippage Too Low',
      explanation: 'The price moved more than your slippage tolerance allows between when you got the quote and when the transaction would execute.',
      suggestions: [
        'Increase slippage tolerance to 2-5%',
        'Try the transaction again quickly',
        'Use a smaller trade amount',
        'Wait for less volatile market conditions'
      ],
      canSimulate: true,
      educationalNote: 'Slippage protection prevents you from getting a much worse price than expected. In volatile markets, you may need higher slippage tolerance, but this increases your risk of getting a worse price.'
    };
  }
  
  if (revertReason.includes('Token approval or balance insufficient')) {
    return {
      title: 'Insufficient Balance or Approval',
      explanation: 'You don\'t have enough tokens in your wallet, or you haven\'t approved the contract to spend your tokens.',
      suggestions: [
        'Check your token balance',
        'Approve the contract to spend your tokens',
        'Make sure you have enough ETH for gas fees',
        'Verify you\'re on the correct network'
      ],
      canSimulate: false,
      educationalNote: 'Token approvals are a security feature in DeFi. You must explicitly allow contracts to spend your tokens. This is a one-time setup per token per contract.'
    };
  }
  
  // Generic failure
  return {
    title: 'Transaction Would Fail',
    explanation: 'This transaction would fail for technical reasons related to the current state of the blockchain or market conditions.',
    suggestions: [
      'Try again with different parameters',
      'Check if the market is still active',
      'Verify your wallet has sufficient balance',
      'Wait for better network conditions'
    ],
    canSimulate: true,
    educationalNote: 'Transaction failures in DeFi are common and usually indicate that market conditions have changed since you got your quote. This is why it\'s important to act quickly after getting a quote.'
  };
}

/**
 * Create a demo transaction response that explains why it would fail
 * but offers educational value and optional simulation
 */
export function createDemoFailureResponse(
  revertReason: string,
  txData: {
    to: string;
    from: string;
    data: string;
    value?: string;
  },
  gasEstimate: {
    gasLimit: bigint;
    totalGasCostEth: string;
    totalGasCostUsd: string;
    maxFeePerGas?: bigint;
    gasPrice?: bigint;
  }
) {
  const explanation = getFailureExplanation(revertReason);
  const gasPrice = gasEstimate.maxFeePerGas || gasEstimate.gasPrice || BigInt(0);
  
  return {
    wouldFail: true,
    explanation,
    gasEstimation: {
      networkFee: `${gasEstimate.totalGasCostEth} ETH ($${gasEstimate.totalGasCostUsd})`,
      gasLimit: gasEstimate.gasLimit.toString(),
      gasPrice: gasPrice > 0 ? `${ethers.formatUnits(gasPrice, 'gwei')} gwei` : 'Unknown',
      estimationMethod: 'demo-educational'
    },
    demoSimulation: explanation.canSimulate ? {
      available: true,
      note: 'We can simulate a successful transaction for educational purposes, but this would fail in a real environment.',
      simulatedResult: explanation.canSimulate ? createDemoTransactionResult(txData, gasEstimate.gasLimit, gasPrice) : null
    } : {
      available: false,
      note: 'This type of failure cannot be simulated as it requires actual balance or approval changes.'
    },
    educationalContent: {
      whatWentWrong: explanation.explanation,
      whyItMatters: explanation.educationalNote,
      howToFix: explanation.suggestions,
      learnMore: [
        'Understanding DeFi transaction failures',
        'How slippage protection works',
        'Managing liquidity and market impact',
        'Token approvals and security'
      ]
    }
  };
}

/**
 * Check if we should offer demo simulation for a failed transaction
 */
export function shouldOfferDemoSimulation(
  revertReason: string | null,
  isDemo: boolean
): boolean {
  if (!isDemo || !revertReason) return false;
  
  // Don't simulate balance/approval issues as they require real fixes
  if (revertReason.includes('Token approval or balance insufficient')) {
    return false;
  }
  
  // Don't simulate if it's a critical system error
  if (revertReason.includes('system') || revertReason.includes('critical')) {
    return false;
  }
  
  // Offer simulation for market condition issues
  return wouldTransactionFail(revertReason);
}

export interface KodiakIsland {
    address: string;
    name: string;
    token0: {
      address: string;
      symbol: string;
      decimals: number;
    };
    token1: {
      address: string;
      symbol: string;
      decimals: number;
    };
    totalSupply: string;
    lowerTick: number;
    upperTick: number;
    feeTier: number;
    manager: string;
    isManaged: boolean;
    managerFeeBPS: number;
    tvl: {
      token0Amount: string;
      token1Amount: string;
      usdValue: number;
    };
    apr: {
      feeApr: number;
      rewardApr?: number;
      combinedApr: number;
      isEstimate: boolean;
    };
    volumeUSD?: string;
    weeklyVolumeUSD?: string;
    currentPrice?: number;
    poolType?: string;
    tick?: number;
  }
  
  export interface KodiakPoolData {
    address: string;
    token0: string;
    token1: string;
    fee: number;
    tickSpacing: number;
    sqrtPriceX96: string;
    liquidity: string;
    tick: number;
  }
  
  export interface KodiakIslandFactory {
    address: string;
    islandCount: number;
  }
  
  export interface KodiakIslandStats {
    total: number;
    uniquePairs: number;
    networks: string[];
  }
  
  export interface KodiakIslandResponse {
    success: boolean;
    data?: {
      islands: KodiakIsland[];
      stats: KodiakIslandStats;
    };
    error?: string;
  }
  
  export interface KodiakQuote {
    amountIn: string;
    amountOut: string;
    priceImpact: number;
    path: string[];
  }
  
  export interface KodiakDepositParams {
    islandAddress: string;
    amount0: string;
    amount1: string;
    amount0Min: string;
    amount1Min: string;
    amountSharesMin: string;
    recipient: string;
  }
  
  export interface KodiakSingleDepositParams {
    islandAddress: string;
    tokenIn: string;
    amountIn: string;
    amountOutMin: string;
    amountSharesMin: string;
    maxSlippageBPS: number;
    recipient: string;
  }
  
  export interface KodiakWithdrawParams {
    islandAddress: string;
    burnAmount: string;
    amount0Min: string;
    amount1Min: string;
    recipient: string;
  }

/**
 * Interface for formatted island data optimized for display
 */
export interface FormattedKodiakIsland {
  // Basic pool information
  poolName: string;
  feeTier: string;
  poolType: string;
  
  // Price information
  range: {
    min: string;
    max: string;
  };
  price: string;
  
  // Financial metrics
  poolTVL: string;
  farmTVL: string;
  apr: {
    base: string;
    boost: string;
  };
  holdings: string;
  
  // Reference data
  address: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  
  // Management information
  management: {
    isManaged: boolean;
    managerAddress: string;
    managerFee: string;
  };
}

/**
 * Response type for the fetchKodiakIslands function
 */
export interface FormattedKodiakIslandsResponse {
  islands: FormattedKodiakIsland[];
  totalCount: number;
  error?: string;
} 

/**
 * Helper function to build a KodiakIsland object from fetched data
 */
export function buildKodiakIslandObject(
  address: string,
  name: string,
  token0: { address: string; symbol?: string; decimals: number },
  token1: { address: string; symbol?: string; decimals: number },
  totalSupply: string,
  lowerTick: number,
  upperTick: number,
  feeTier: number,
  manager: string,
  isManaged: boolean,
  managerFeeBPS: number,
  balances: { 0: bigint | string | number, 1: bigint | string | number } | Array<bigint | string | number>,
  tick?: number
): KodiakIsland {
  return {
    address,
    name,
    token0: {
      address: token0.address,
      symbol: token0.symbol || 'Token0',
      decimals: token0.decimals
    },
    token1: {
      address: token1.address,
      symbol: token1.symbol || 'Token1',
      decimals: token1.decimals
    },
    totalSupply,
    lowerTick,
    upperTick,
    feeTier,
    manager,
    isManaged,
    managerFeeBPS,
    tvl: {
      token0Amount: balances[0].toString(),
      token1Amount: balances[1].toString(),
      usdValue: 0 // Can't determine USD value from on-chain data
    },
    apr: {
      feeApr: 0,
      rewardApr: 0,
      combinedApr: 0,
      isEstimate: true // On-chain data doesn't provide APR information
    },
    poolType: 'Island',
    tick
  };
} 

/**
 * Interface for Token with address and decimals
 */
export interface Token {
  address: string;
  decimals: number;
  symbol?: string;
}

/**
 * Interface for the Island state
 */
export interface IslandState {
  amount0: bigint;
  amount1: bigint;
  ratio: bigint;
}

/**
 * Interface for swap calculation result
 */
export interface SwapCalculationResult {
  amountToSwap: bigint;
  amountToKeep: bigint;
  expectedOutput: bigint;
  islandAddress: string;
  tokenInAddress: string;
  tokenOutAddress: string;
}

/**
 * Interface for Kodiak Quote API response
 */
export interface KodiakQuoteResult {
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

/**
 * Interface for deposit result
 */
export interface DepositResult {
  status: 'success' | 'fail';
  hash?: string;
  error_message?: string;
} 

/**
 * Interface for single token deposit to Kodiak Island
 */
export interface IslandSingleDepositParams {
  islandAddress: string;
  totalAmount: string; // Amount in human-readable format
  isToken0: boolean;
  slippageBPS: number; // Slippage in basis points (e.g., 50 for 0.5%)
  minSharesReceived: string; // Minimum shares to receive
} 
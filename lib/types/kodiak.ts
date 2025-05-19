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
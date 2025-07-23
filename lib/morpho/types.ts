export interface MorphoMarket {
  uniqueKey: string
  lltv: string
  oracleAddress: string
  irmAddress: string
  loanAsset: {
    address: string
    symbol: string
    decimals: number
  }
  collateralAsset: {
    address: string
    symbol: string
    decimals: number
  }
  state: {
    borrowAssets: string
    supplyAssets: string
    borrowAssetsUsd: number
    supplyAssetsUsd: number
    fee: string
    utilization: string
    supplyApy: number
    borrowApy: number
    rewards?: {
      asset: { address: string }
      supplyApr: number
      borrowApr: number
    }[]
  }
}

export interface MorphoMarketPosition {
  user: { address: string }
  state: {
    collateral: string
    borrowAssets: string
    borrowAssetsUsd: number
    healthFactor?: number
  }
}

export interface MorphoMarketsResponse {
  markets: {
    items: MorphoMarket[]
  }
}

export interface MorphoMarketResponse {
  marketByUniqueKey: MorphoMarket
}

export interface BorrowingRateData {
  marketKey: string
  borrowApy: number
  supplyApy: number
  utilization: number
  totalBorrowAssets: number
  totalSupplyAssets: number
  availableLiquidity: number
  collateralAsset: string
  loanAsset: string
  maxLtv: number
}

export interface LoopingOpportunity {
  ptToken: string
  ptAddress: string
  ptExpiry: string
  daysToExpiry: number
  ptYield: number
  morphoMarketKey: string
  borrowRate: number
  yieldSpread: number
  maxLeverage: number
  estimatedApyAt2x: number
  estimatedApyAt3x: number
  estimatedApyAt4x: number
  liquidationThreshold: number
  availableLiquidity: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface LoopingPosition {
  id: string
  userAddress: string
  ptToken: string
  morphoMarketKey: string
  totalCollateralValue: number
  totalBorrowValue: number
  currentLeverage: number
  healthFactor: number
  estimatedApy: number
  createdAt: number
  lastUpdatedAt: number
}
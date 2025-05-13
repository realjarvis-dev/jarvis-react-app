export interface PendleMarket {
  name: string
  address: string
  expiry: string
  pt: string
  yt: string
  sy: string
  underlyingAsset: string
  details: {
    liquidity: number
    pendleApy: number
    impliedApy: number
    feeRate: number
    movement10Percent: {
      ptMovementUpUsd: number
      ptMovementDownUsd: number
      ytMovementUpUsd: number
      ytMovementDownUsd: number
    }
    yieldRange: {
      min: number
      max: number
    }
    aggregatedApy: number
    maxBoostedApy: number
  }
  isNew: boolean
  timestamp: string
}

export interface PendleResponse {
  markets: PendleMarket[]
}

export interface SimplifiedPendleMarket {
  name: string
  address: string
  expiry: string
  pt: string
  yt: string
  sy: string
  underlyingAsset: string
  liquidity: number
  impliedApy: number
} 
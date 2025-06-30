export interface DeFiLlamaProtocol {
  id: string
  name: string
  address: string | null
  symbol: string
  url: string
  description: string
  chain: string
  logo: string
  audits: string
  audit_note: string | null
  gecko_id: string | null
  cmcId: string | null
  category: string
  chains: string[]
  module: string
  twitter: string | null
  forkedFrom: string[]
  listedAt: number
  methodology?: string
  slug: string
  tvl: number
  chainTvls: Record<string, number>
  change_1h: number | null
  change_1d: number | null
  change_7d: number | null
  tokenBreakdowns: Record<string, any>
  mcap: number | null
  staking?: number
  pool2?: number
}

export interface DeFiLlamaYield {
  pool: string
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apyBase: number
  apyReward: number
  apy: number
  rewardTokens: string[]
  count: number
  outlier: boolean
  mu: number
  sigma: number
  il7d: number
  apyBase7d: number
  apyMean30d: number
  volumeUsd1d: number
  volumeUsd7d: number
  stablecoin: boolean
  ilRisk: string
  exposure: string
  predictions: {
    predictedClass: string
    predictedProbability: number
    binnedConfidence: number
  }
  poolMeta: string | null
  underlyingTokens: string[]
  url: string
}

export interface DeFiLlamaTVLData {
  date: string
  totalLiquidityUSD: number
}

export interface DeFiLlamaChain {
  gecko_id: string | null
  tvl: number
  tokenSymbol: string | null
  cmcId: string | null
  name: string
  chainId: number | null
}

export interface ProtocolsFilters {
  category?: string
  chain?: string
  minTvl?: number
  maxTvl?: number
  sortBy?: 'tvl' | 'change_1d' | 'change_7d' | 'change_1h'
  sortOrder?: 'asc' | 'desc'
  limit?: number
}

export interface YieldsFilters {
  chain?: string
  project?: string
  minTvl?: number
  maxTvl?: number
  minApy?: number
  maxApy?: number
  stablecoin?: boolean
  sortBy?: 'apy' | 'tvlUsd' | 'apyBase' | 'apyReward'
  sortOrder?: 'asc' | 'desc'
  limit?: number
}

export interface DeFiOpportunity {
  protocol: DeFiLlamaProtocol
  opportunities: {
    tvlGrowth: number
    yieldOpportunities: DeFiLlamaYield[]
    riskLevel: 'low' | 'medium' | 'high'
    momentum: 'strong' | 'moderate' | 'weak'
  }
}
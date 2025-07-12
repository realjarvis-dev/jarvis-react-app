export interface EnsoConfig {
  apiKey: string
  baseUrl?: string
}

export interface EnsoRouteParams {
  fromAddress: string
  receiver?: string
  spender?: string
  chainId: number
  destinationChainId?: number
  amountIn: string[]
  tokenIn: string[]
  tokenOut: string[]
  slippage?: string
  minAmountOut?: string[]
  routingStrategy: 'router' | 'delegate'
  fee?: string[]
  feeReceiver?: string
  referralCode?: string
}

export interface EnsoRouteResponse {
  tx: {
    to: string
    data: string
    value: string
    gas: string
  }
  amountOut: string[]
  gas: string
  route: EnsoRouteStep[]
  priceImpact?: string
  feeAmount?: string
}

export interface EnsoRouteStep {
  protocol: string
  action: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  amountOut: string
  gas: string
}

export interface EnsoBundleAction {
  protocol: string
  action: string
  args: Record<string, any>
}

export interface EnsoBundleParams {
  chainId: number
  fromAddress: string
  routingStrategy: 'router' | 'delegate'
  receiver?: string
  spender?: string
  ignoreAggregators?: string[]
  referralCode?: string
  ignoreStandards?: string[]
}

export interface EnsoBundleResponse {
  tx: {
    to: string
    data: string
    value: string
    gas: string
  }
  amountOut?: string[]
  gas: string
  route?: EnsoRouteStep[]
}

export interface EnsoTokenData {
  address: string
  chainId: number
  symbol: string
  name: string
  decimals: number
  logoUri?: string
  price?: number
  apy?: number
  tvl?: number
  project?: string
  protocolSlug?: string
  underlyingTokens?: string[]
  primaryAddress?: string
  type: 'base' | 'defi'
}

export interface EnsoBalanceData {
  token: string
  amount: string
  decimals: number
  price: number
  name: string
  symbol: string
  logoUri?: string
}

export interface EnsoSimulationResult {
  success: boolean
  canExecute: boolean
  estimatedGas: string
  expectedOutputs: Array<{
    token: string
    amount: string
    usdValue: string
    symbol: string
  }>
  priceImpact?: string
  failureReason?: string
  warnings: string[]
  risks: Array<{
    type: 'high' | 'medium' | 'low'
    message: string
  }>
  stepResults?: Array<{
    step: number
    action: string
    protocol: string
    status: 'success' | 'failed' | 'simulated'
    gasUsed: string
    output?: string
  }>
  confidence: number
  riskLevel: 'low' | 'medium' | 'high'
}

export interface EnsoStrategy {
  id: string
  name: string
  description: string
  category: 'yield' | 'arbitrage' | 'leverage' | 'crosschain' | 'compound'
  riskLevel: 'low' | 'medium' | 'high'
  expectedAPY: string
  inputs: Array<{
    token: string
    amount: string
    symbol: string
  }>
  outputs: Array<{
    token: string
    symbol: string
    protocol?: string
  }>
  routeData?: EnsoRouteResponse
  bundleData?: EnsoBundleResponse
  simulation?: EnsoSimulationResult
  walletType: 'EOA' | 'SmartWallet' | 'Both'
  minimumAmount?: string
  tags: string[]
}

export type EnsoError = {
  code: string
  message: string
  details?: any
}
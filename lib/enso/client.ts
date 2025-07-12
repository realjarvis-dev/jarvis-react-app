import { EnsoClient } from '@ensofinance/sdk'
import {
  EnsoConfig,
  EnsoRouteParams,
  EnsoRouteResponse,
  EnsoBundleParams,
  EnsoBundleAction,
  EnsoBundleResponse,
  EnsoTokenData,
  EnsoBalanceData,
  EnsoError
} from './types'

export class JarvisEnsoClient {
  private client: EnsoClient
  private config: EnsoConfig

  constructor(config: EnsoConfig) {
    this.config = config
    this.client = new EnsoClient({
      apiKey: config.apiKey
    })
  }

  /**
   * Get optimal route for token swap or position entry/exit
   */
  async getRoute(params: EnsoRouteParams): Promise<EnsoRouteResponse> {
    try {
      const routeData = await this.client.getRouteData({
        fromAddress: params.fromAddress as `0x${string}`,
        receiver: params.receiver as `0x${string}`,
        spender: params.spender as `0x${string}`,
        chainId: params.chainId,
        destinationChainId: params.destinationChainId,
        amountIn: params.amountIn,
        tokenIn: params.tokenIn.map(token => token as `0x${string}`),
        tokenOut: params.tokenOut.map(token => token as `0x${string}`),
        slippage: params.slippage,
        minAmountOut: params.minAmountOut,
        routingStrategy: params.routingStrategy,
        fee: params.fee,
        feeReceiver: params.feeReceiver as `0x${string}` | undefined,
        referralCode: params.referralCode
      })

      return {
        tx: {
          to: routeData.tx.to,
          data: routeData.tx.data,
          value: routeData.tx.value.toString(),
          gas: routeData.gas.toString()
        },
        amountOut: Array.isArray(routeData.amountOut) 
          ? routeData.amountOut.map(amount => amount.toString()) 
          : [routeData.amountOut.toString()],
        gas: routeData.gas.toString(),
        route: (routeData.route || []).map(hop => ({
          protocol: hop.protocol,
          action: hop.action || 'swap',
          tokenIn: Array.isArray(hop.tokenIn) ? hop.tokenIn[0] : hop.tokenIn,
          tokenOut: Array.isArray(hop.tokenOut) ? hop.tokenOut[0] : hop.tokenOut,
          amountIn: (hop as any).amountIn?.toString() || '0',
          amountOut: (hop as any).amountOut?.toString() || '0',
          gas: (hop as any).gas?.toString() || '0'
        })),
        priceImpact: routeData.priceImpact?.toString(),
        feeAmount: routeData.feeAmount?.toString()
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to get route')
    }
  }

  /**
   * Create bundle transaction for complex multi-step strategies
   */
  async createBundle(
    params: EnsoBundleParams,
    actions: EnsoBundleAction[]
  ): Promise<EnsoBundleResponse> {
    try {
      const bundleData = await this.client.getBundleData({
        ...params,
        fromAddress: params.fromAddress as `0x${string}`,
        receiver: params.receiver as `0x${string}` | undefined,
        spender: params.spender as `0x${string}` | undefined
      }, actions as any)

      return {
        tx: {
          to: bundleData.tx.to,
          data: bundleData.tx.data,
          value: bundleData.tx.value.toString(),
          gas: bundleData.gas.toString()
        },
        amountOut: Array.isArray(bundleData.amountsOut) 
          ? bundleData.amountsOut.map(amount => amount.toString()) 
          : [bundleData.amountsOut?.toString() || '0'],
        gas: bundleData.gas.toString(),
        route: (bundleData.route || []).map(hop => ({
          protocol: hop.protocol,
          action: hop.action || 'bundle',
          tokenIn: Array.isArray(hop.tokenIn) ? hop.tokenIn[0] : hop.tokenIn,
          tokenOut: Array.isArray(hop.tokenOut) ? hop.tokenOut[0] : hop.tokenOut,
          amountIn: (hop as any).amountIn?.toString() || '0',
          amountOut: (hop as any).amountOut?.toString() || '0',
          gas: (hop as any).gas?.toString() || '0'
        }))
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to create bundle')
    }
  }

  /**
   * Get token information including DeFi positions
   */
  async getTokens(params: {
    chainId?: number
    address?: string[]
    type?: 'base' | 'defi'
    protocolSlug?: string
    project?: string
    underlyingTokens?: string
    apyFrom?: number
    apyTo?: number
    tvlFrom?: number
    tvlTo?: number
    includeMetadata?: boolean
    page?: number
    symbol?: string[]
    name?: string[]
  }): Promise<{ data: EnsoTokenData[]; pagination?: any }> {
    try {
      const tokenData = await this.client.getTokenData(params as any)
      
      return {
        data: tokenData.data.map(token => ({
          address: token.address,
          chainId: token.chainId,
          symbol: token.symbol || 'UNKNOWN',
          name: token.name || 'Unknown Token',
          decimals: token.decimals,
          logoUri: token.logosUri?.[0] || undefined,
          price: Number((token as any).price) || 0,
          apy: Number((token as any).apy) || 0,
          tvl: Number((token as any).tvl) || 0,
          project: token.project || undefined,
          protocolSlug: token.protocolSlug || undefined,
          underlyingTokens: token.underlyingTokens?.map(t => typeof t === 'string' ? t : t.address) || undefined,
          primaryAddress: token.primaryAddress || undefined,
          type: token.type as 'base' | 'defi'
        })),
        pagination: (tokenData as any).pagination
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to get tokens')
    }
  }

  /**
   * Get user wallet balances across chains
   */
  async getBalances(params: {
    chainId?: number
    eoaAddress: string
    useEoa?: boolean
  }): Promise<EnsoBalanceData[]> {
    try {
      const balances = await this.client.getBalances({
        ...params,
        eoaAddress: params.eoaAddress as `0x${string}`
      })
      
      return balances.map(balance => ({
        token: balance.token,
        amount: balance.amount.toString(),
        decimals: balance.decimals,
        price: Number(balance.price),
        name: balance.name,
        symbol: balance.symbol,
        logoUri: balance.logoUri
      }))
    } catch (error) {
      throw this.handleError(error, 'Failed to get balances')
    }
  }

  /**
   * Get token price data
   */
  async getTokenPrice(chainId: number, address: string): Promise<{ price: number; confidence: number }> {
    try {
      const priceData = await this.client.getPriceData({ chainId, address: address as `0x${string}` })
      return {
        price: Number(priceData.price),
        confidence: priceData.confidence || 1
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to get token price')
    }
  }

  /**
   * Get multiple token prices
   */
  async getMultipleTokenPrices(
    chainId: number, 
    addresses: string[]
  ): Promise<Array<{ address: string; price: number; confidence: number }>> {
    try {
      const priceData = await this.client.getMultiplePriceData({ chainId, addresses: addresses.map(addr => addr as `0x${string}`) })
      return priceData.map((price, index) => ({
        address: addresses[index],
        price: Number(price.price),
        confidence: price.confidence || 1
      }))
    } catch (error) {
      throw this.handleError(error, 'Failed to get multiple token prices')
    }
  }

  /**
   * Get supported protocols
   */
  async getProtocols(params?: { chainId?: number; slug?: string }) {
    try {
      return await this.client.getProtocolData(params)
    } catch (error) {
      throw this.handleError(error, 'Failed to get protocols')
    }
  }

  /**
   * Get supported networks
   */
  async getNetworks() {
    try {
      return await this.client.getNetworks()
    } catch (error) {
      throw this.handleError(error, 'Failed to get networks')
    }
  }

  /**
   * Get transaction approval data
   */
  async getApprovalData(params: {
    fromAddress: string
    tokenAddress: string
    chainId: number
    amount: string
  }) {
    try {
      return await this.client.getApprovalData({
        ...params,
        fromAddress: params.fromAddress as `0x${string}`,
        tokenAddress: params.tokenAddress as `0x${string}`
      })
    } catch (error) {
      throw this.handleError(error, 'Failed to get approval data')
    }
  }

  private handleError(error: any, context: string): EnsoError {
    console.error(`${context}:`, error)
    
    if (error.response?.data) {
      return {
        code: error.response.status?.toString() || 'ENSO_ERROR',
        message: error.response.data.error || error.response.data.message || context,
        details: error.response.data
      }
    }
    
    return {
      code: 'ENSO_ERROR',
      message: error.message || context,
      details: error
    }
  }
}

// Create singleton instance
let ensoClient: JarvisEnsoClient | null = null

export function getEnsoClient(): JarvisEnsoClient {
  if (!ensoClient) {
    const apiKey = process.env.ENSO_API_KEY || process.env.NEXT_PUBLIC_ENSO_API_KEY

    if (!apiKey) {
      throw new Error('ENSO_API_KEY is required but not provided')
    }

    ensoClient = new JarvisEnsoClient({
      apiKey,
      baseUrl: 'https://api.enso.finance'
    })
  }

  return ensoClient
}

export default JarvisEnsoClient
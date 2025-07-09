import { lazyPendleTokenLoader } from './config/pendle/lazy-tokens'
import { type PendleToken } from './config/pendle/tokens'

export type { PendleToken }

export interface PendleMarketInfo {
  name: string
  address: string
  expiry: string
  pt: string
  yt: string
  sy: string
  underlyingAsset: string
}

export class PendleTokenMatcher {
  private static instance: PendleTokenMatcher
  private tokensByAddress: Map<string, PendleToken> = new Map()
  private marketsByAddress: Map<string, PendleMarketInfo> = new Map()
  private chainInitialized: Set<string> = new Set()

  private constructor() {
    // No longer build maps eagerly
  }

  public static getInstance(): PendleTokenMatcher {
    if (!PendleTokenMatcher.instance) {
      PendleTokenMatcher.instance = new PendleTokenMatcher()
    }
    return PendleTokenMatcher.instance
  }

  private async initializeChain(chainId: string): Promise<void> {
    if (this.chainInitialized.has(chainId)) {
      return
    }

    try {
      const tokens = await lazyPendleTokenLoader.getTokensForChain(chainId)
      
      for (const token of tokens) {
        const key = `${chainId}-${token.address.toLowerCase()}`
        this.tokensByAddress.set(key, token)
        
        const marketKey = `${chainId}-${token.marketAddress.toLowerCase()}`
        if (!this.marketsByAddress.has(marketKey)) {
          const marketTokens = tokens.filter(t => t.marketAddress.toLowerCase() === token.marketAddress.toLowerCase())
          const ptToken = marketTokens.find(t => t.tokenType === 'pt')
          const ytToken = marketTokens.find(t => t.tokenType === 'yt')
          const syToken = marketTokens.find(t => t.tokenType === 'sy')
          
          if (ptToken) {
            this.marketsByAddress.set(marketKey, {
              name: ptToken.name.replace('PT ', '').split(' ')[0],
              address: token.marketAddress,
              expiry: token.expiry,
              pt: ptToken.address,
              yt: ytToken?.address || '',
              sy: syToken?.address || '',
              underlyingAsset: token.underlyingAsset
            })
          }
        }
      }
      
      this.chainInitialized.add(chainId)
    } catch (error) {
      console.error(`Failed to initialize Pendle tokens for chain ${chainId}:`, error)
    }
  }

  public async findTokenByAddress(tokenAddress: string, chainId: number): Promise<PendleToken | null> {
    const chainKey = chainId.toString()
    await this.initializeChain(chainKey)
    
    const key = `${chainId}-${tokenAddress.toLowerCase()}`
    return this.tokensByAddress.get(key) || null
  }

  public async findMarketByTokenAddress(tokenAddress: string, tokenType: 'pt' | 'yt' | 'sy', chainId: number): Promise<PendleMarketInfo | null> {
    const token = await this.findTokenByAddress(tokenAddress, chainId)
    if (!token) return null
    
    const marketKey = `${chainId}-${token.marketAddress.toLowerCase()}`
    return this.marketsByAddress.get(marketKey) || null
  }

  public async getAllTokensForChain(chainId: number): Promise<PendleToken[]> {
    const chainKey = chainId.toString()
    return lazyPendleTokenLoader.getTokensForChain(chainKey)
  }

  public async getAllMarketsForChain(chainId: number): Promise<PendleMarketInfo[]> {
    const chainKey = chainId.toString()
    await this.initializeChain(chainKey)
    
    const markets: PendleMarketInfo[] = []
    
    for (const [key, market] of this.marketsByAddress.entries()) {
      if (key.startsWith(`${chainKey}-`)) {
        markets.push(market)
      }
    }
    
    return markets
  }
}

export const pendleTokenMatcher = PendleTokenMatcher.getInstance()

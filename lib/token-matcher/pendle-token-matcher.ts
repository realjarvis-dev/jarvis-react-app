import { pendleTokensByChain, type PendleToken } from './config/pendle/tokens'

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

  private constructor() {
    this.buildTokenMaps()
  }

  public static getInstance(): PendleTokenMatcher {
    if (!PendleTokenMatcher.instance) {
      PendleTokenMatcher.instance = new PendleTokenMatcher()
    }
    return PendleTokenMatcher.instance
  }

  private buildTokenMaps(): void {
    for (const [chainId, tokens] of Object.entries(pendleTokensByChain)) {
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
    }
  }

  public findTokenByAddress(tokenAddress: string, chainId: number): PendleToken | null {
    const key = `${chainId}-${tokenAddress.toLowerCase()}`
    return this.tokensByAddress.get(key) || null
  }

  public findMarketByTokenAddress(tokenAddress: string, tokenType: 'pt' | 'yt' | 'sy', chainId: number): PendleMarketInfo | null {
    const token = this.findTokenByAddress(tokenAddress, chainId)
    if (!token) return null
    
    const marketKey = `${chainId}-${token.marketAddress.toLowerCase()}`
    return this.marketsByAddress.get(marketKey) || null
  }

  public getAllTokensForChain(chainId: number): PendleToken[] {
    return pendleTokensByChain[chainId.toString()] || []
  }

  public getAllMarketsForChain(chainId: number): PendleMarketInfo[] {
    const markets: PendleMarketInfo[] = []
    const chainKey = chainId.toString()
    
    for (const [key, market] of this.marketsByAddress.entries()) {
      if (key.startsWith(`${chainKey}-`)) {
        markets.push(market)
      }
    }
    
    return markets
  }
}

export const pendleTokenMatcher = PendleTokenMatcher.getInstance()

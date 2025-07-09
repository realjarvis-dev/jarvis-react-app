import { TokenMatcher, type Token, type ScoredToken } from './fuzzy-token-matcher'
import { pendleTokenMatcher } from './pendle-token-matcher'
import type { PendleToken } from './config/pendle/tokens'

export class UnifiedTokenMatcher {
  private tokenMatcher: TokenMatcher
  private chainId: number

  constructor(chainId: number, threshold = 0.3) {
    this.chainId = chainId
    this.tokenMatcher = new TokenMatcher(chainId, threshold)
  }

  public async match(query: string, limit = 5): Promise<ScoredToken[]> {
    return this.tokenMatcher.match(query, limit)
  }

  public async findPendleToken(tokenAddress: string): Promise<PendleToken | null> {
    return pendleTokenMatcher.findTokenByAddress(tokenAddress, this.chainId)
  }

  public async findPendleMarket(tokenAddress: string, tokenType: 'pt' | 'yt' | 'sy') {
    return pendleTokenMatcher.findMarketByTokenAddress(tokenAddress, tokenType, this.chainId)
  }

  public async getAllPendleTokens(): Promise<PendleToken[]> {
    return pendleTokenMatcher.getAllTokensForChain(this.chainId)
  }
}

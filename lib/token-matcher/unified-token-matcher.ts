import { TokenMatcher, type Token } from './fuzzy-token-matcher'
import { pendleTokenMatcher } from './pendle-token-matcher'
import type { PendleToken } from './config/pendle/tokens'

export class UnifiedTokenMatcher {
  private tokenMatcher: TokenMatcher
  private chainId: number

  constructor(chainId: number, threshold = 0.3) {
    this.chainId = chainId
    this.tokenMatcher = new TokenMatcher(chainId, threshold)
  }

  public match(query: string, limit = 5): Token[] {
    return this.tokenMatcher.match(query, limit)
  }

  public findPendleToken(tokenAddress: string): PendleToken | null {
    return pendleTokenMatcher.findTokenByAddress(tokenAddress, this.chainId)
  }

  public findPendleMarket(tokenAddress: string, tokenType: 'pt' | 'yt' | 'sy') {
    return pendleTokenMatcher.findMarketByTokenAddress(tokenAddress, tokenType, this.chainId)
  }

  public getAllPendleTokens(): PendleToken[] {
    return pendleTokenMatcher.getAllTokensForChain(this.chainId)
  }
}

// fuzzyTokenMatcher.js
import Fuse from 'fuse.js'
import { tokensByChain } from './config/lifi/tokens'
import { pendleTokensByChain, type PendleToken } from './config/pendle/tokens'

export type Token = {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
}

// Define a type for the keys of tokensByChain
type ChainIdKey = keyof typeof tokensByChain

export class TokenMatcher {
  private fuse: Fuse<Token>
  private chainId: string
  private tokenList: Token[]
  /**
   * @param {number|string} chainId
   */
  constructor(chainId: number, threshold = 0.3, tokenList?: Token[]) {
    this.chainId = String(chainId)
    
    if (tokenList) {
      this.tokenList = tokenList
    } else {
      const lifiTokens = tokensByChain[this.chainId as ChainIdKey] || []
      const pendleTokens = pendleTokensByChain[this.chainId] || []
      
      const convertedPendleTokens: Token[] = pendleTokens.map((token: PendleToken) => ({
        chainId: token.chainId,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals
      }))
      
      this.tokenList = [...lifiTokens, ...convertedPendleTokens]
    }

    this.fuse = new Fuse(this.tokenList, {
      keys: [
        { name: 'symbol', weight: 0.7 },
        { name: 'name', weight: 0.3 },
        { name: 'address', weight: 0.3 }
      ],
      threshold,
      ignoreLocation: true,
      minMatchCharLength: 1
    })
  }

  /**
   * @param {string} query — symbol or name to search
   * @returns {{...Token, score: number}[]}
   */
  match(query: string, limit = 5): Token[] {
    return this.fuse
      .search(query, { limit }).map(({ item }) => item)
  }
}

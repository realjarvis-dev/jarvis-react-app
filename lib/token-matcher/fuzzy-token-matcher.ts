// fuzzyTokenMatcher.js
import Fuse from 'fuse.js'
import { tokensByChain } from './config/lifi/tokens'

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
    this.tokenList = tokenList || tokensByChain[this.chainId as ChainIdKey] || []

    this.fuse = new Fuse(this.tokenList, {
      keys: [
        { name: 'symbol', weight: 0.7 },
        { name: 'name', weight: 0.3 }
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

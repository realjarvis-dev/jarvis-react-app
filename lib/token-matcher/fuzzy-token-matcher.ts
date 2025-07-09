// fuzzyTokenMatcher.js
import Fuse from 'fuse.js'
import { lazyTokenLoader } from './config/lifi/lazy-tokens'
import { lazyPendleTokenLoader } from './config/pendle/lazy-tokens'
import { type PendleToken } from './config/pendle/tokens'

export type Token = {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
}

export type ScoredToken = Token & {
  score: number
}

// Define a type for the keys of tokensByChain
type ChainIdKey = string

export class TokenMatcher {
  private fuse: Fuse<Token> | null = null
  private chainId: string
  private tokenList: Token[] = []
  private threshold: number
  private initialized = false
  private initPromise: Promise<void> | null = null

  /**
   * @param {number|string} chainId
   */
  constructor(chainId: number, threshold = 0.3, tokenList?: Token[]) {
    this.chainId = String(chainId)
    this.threshold = threshold
    
    if (tokenList) {
      this.tokenList = tokenList
      this.initializeFuse()
      this.initialized = true
    }
  }

  /**
   * Initialize token matcher with lazy loading
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return
    
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.loadTokensAndInitialize()
    await this.initPromise
  }

  /**
   * Load tokens lazily and initialize Fuse
   */
  private async loadTokensAndInitialize(): Promise<void> {
    try {
      const [lifiTokens, pendleTokens] = await Promise.all([
        lazyTokenLoader.getTokensForChain(this.chainId),
        lazyPendleTokenLoader.getTokensForChain(this.chainId)
      ])
      
      const convertedPendleTokens: Token[] = pendleTokens.map((token: PendleToken) => ({
        chainId: token.chainId,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals
      }))
      
      this.tokenList = [...lifiTokens, ...convertedPendleTokens]
      this.initializeFuse()
      this.initialized = true
    } catch (error) {
      console.error(`Failed to initialize TokenMatcher for chain ${this.chainId}:`, error)
      this.tokenList = []
      this.initializeFuse()
      this.initialized = true
    }
  }

  /**
   * Initialize Fuse search engine
   */
  private initializeFuse(): void {
    this.fuse = new Fuse(this.tokenList, {
      keys: [
        { name: 'symbol', weight: 0.7 },
        { name: 'name', weight: 0.3 },
        { name: 'address', weight: 0.3 }
      ],
      threshold: this.threshold,
      ignoreLocation: true,
      minMatchCharLength: 1
    })
  }

  /**
   * @param {string} query — symbol or name to search
   * @returns {Promise<ScoredToken[]>}
   */
  async match(query: string, limit = 5): Promise<ScoredToken[]> {
    await this.initialize()
    
    if (!this.fuse) {
      return []
    }
    
    return this.fuse
      .search(query, { limit })
      .map(({ item, score }) => ({ ...item, score: score || 0 }))
  }

  /**
   * Get all tokens for the chain (lazy loaded)
   */
  async getAllTokens(): Promise<Token[]> {
    await this.initialize()
    return this.tokenList
  }

  /**
   * Get token by exact address match
   */
  async getTokenByAddress(address: string): Promise<Token | undefined> {
    await this.initialize()
    return this.tokenList.find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    )
  }
}

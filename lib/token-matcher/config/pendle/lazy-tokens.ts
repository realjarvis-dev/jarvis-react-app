import { PendleToken } from './tokens'

/**
 * Lazy-loaded Pendle token configuration
 * Reduces memory usage by loading tokens on-demand per chain
 */
export class LazyPendleTokenLoader {
  private tokenCache = new Map<string, PendleToken[]>()
  private loadingPromises = new Map<string, Promise<PendleToken[]>>()
  private readonly MAX_CACHED_CHAINS = 10 // Prevent cache from growing indefinitely

  /**
   * Get Pendle tokens for a specific chain with lazy loading
   */
  async getTokensForChain(chainId: string): Promise<PendleToken[]> {
    // Return cached tokens if available
    if (this.tokenCache.has(chainId)) {
      return this.tokenCache.get(chainId)!
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(chainId)) {
      return this.loadingPromises.get(chainId)!
    }

    // Start loading tokens for this chain
    const loadingPromise = this.loadTokensForChain(chainId)
    this.loadingPromises.set(chainId, loadingPromise)

    try {
      const tokens = await loadingPromise
      
      // Cache with size limit
      if (this.tokenCache.size >= this.MAX_CACHED_CHAINS) {
        // Remove oldest cache entry
        const firstKey = this.tokenCache.keys().next().value
        if (firstKey) {
          this.tokenCache.delete(firstKey)
          console.log(`🧹 Evicted Pendle token cache for chain ${firstKey}`)
        }
      }
      
      this.tokenCache.set(chainId, tokens)
      return tokens
    } finally {
      this.loadingPromises.delete(chainId)
    }
  }

  /**
   * Load tokens for a specific chain from the original file
   */
  private async loadTokensForChain(chainId: string): Promise<PendleToken[]> {
    try {
      // Dynamic import to avoid loading all tokens at once
      const { pendleTokensByChain } = await import('./tokens')
      return pendleTokensByChain[chainId] || []
    } catch (error) {
      console.error(`Failed to load Pendle tokens for chain ${chainId}:`, error)
      return []
    }
  }

  /**
   * Get tokens for multiple chains efficiently
   */
  async getTokensForChains(chainIds: string[]): Promise<Record<string, PendleToken[]>> {
    const results: Record<string, PendleToken[]> = {}
    
    // Load all requested chains in parallel
    const loadPromises = chainIds.map(async (chainId) => {
      const tokens = await this.getTokensForChain(chainId)
      results[chainId] = tokens
    })

    await Promise.all(loadPromises)
    return results
  }

  /**
   * Get tokens by type for a specific chain
   */
  async getTokensByType(chainId: string, tokenType: 'pt' | 'yt' | 'sy'): Promise<PendleToken[]> {
    const tokens = await this.getTokensForChain(chainId)
    return tokens.filter(token => token.tokenType === tokenType)
  }

  /**
   * Find token by address
   */
  async findTokenByAddress(chainId: string, address: string): Promise<PendleToken | undefined> {
    const tokens = await this.getTokensForChain(chainId)
    return tokens.find(token => token.address.toLowerCase() === address.toLowerCase())
  }

  /**
   * Search tokens by symbol or name
   */
  async searchTokens(chainId: string, query: string): Promise<PendleToken[]> {
    const tokens = await this.getTokensForChain(chainId)
    const lowerQuery = query.toLowerCase()
    
    return tokens.filter(token => 
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Preload tokens for commonly used chains
   */
  async preloadCommonChains(): Promise<void> {
    const commonChains = ['1', '42161'] // Ethereum, Arbitrum (main Pendle chains)
    await this.getTokensForChains(commonChains)
  }

  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    this.tokenCache.clear()
    console.log('🧹 Cleared Pendle token cache')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cachedChains: number; totalTokens: number } {
    let totalTokens = 0
    for (const tokens of this.tokenCache.values()) {
      totalTokens += tokens.length
    }
    
    return {
      cachedChains: this.tokenCache.size,
      totalTokens
    }
  }
}

// Export singleton instance
export const lazyPendleTokenLoader = new LazyPendleTokenLoader()

// Backwards compatibility function
export async function getPendleTokensByChain(chainId: string): Promise<PendleToken[]> {
  return lazyPendleTokenLoader.getTokensForChain(chainId)
}

// Preload common chains for better UX
if (typeof window === 'undefined') {
  // Only preload on server side to avoid blocking client
  lazyPendleTokenLoader.preloadCommonChains().catch(console.error)
}
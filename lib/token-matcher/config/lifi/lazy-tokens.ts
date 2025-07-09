import { Token } from '../../fuzzy-token-matcher'

type ChainIdKey = string

/**
 * Lazy-loaded token configuration for LiFi
 * Reduces memory usage by loading tokens on-demand per chain
 */
export class LazyTokenLoader {
  private tokenCache = new Map<ChainIdKey, Token[]>()
  private loadingPromises = new Map<ChainIdKey, Promise<Token[]>>()
  private readonly MAX_CACHED_CHAINS = 20 // Prevent cache from growing indefinitely

  /**
   * Get tokens for a specific chain with lazy loading
   */
  async getTokensForChain(chainId: ChainIdKey): Promise<Token[]> {
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
          console.log(`🧹 Evicted token cache for chain ${firstKey}`)
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
  private async loadTokensForChain(chainId: ChainIdKey): Promise<Token[]> {
    try {
      // Dynamic import to avoid loading all tokens at once
      const { tokensByChain } = await import('./tokens')
      return (tokensByChain as any)[chainId] || []
    } catch (error) {
      console.error(`Failed to load tokens for chain ${chainId}:`, error)
      return []
    }
  }

  /**
   * Get tokens for multiple chains efficiently
   */
  async getTokensForChains(chainIds: ChainIdKey[]): Promise<Record<ChainIdKey, Token[]>> {
    const results: Record<ChainIdKey, Token[]> = {}
    
    // Load all requested chains in parallel
    const loadPromises = chainIds.map(async (chainId) => {
      const tokens = await this.getTokensForChain(chainId)
      results[chainId] = tokens
    })

    await Promise.all(loadPromises)
    return results
  }

  /**
   * Preload tokens for commonly used chains
   */
  async preloadCommonChains(): Promise<void> {
    const commonChains: ChainIdKey[] = ['1', '137', '42161', '8453', '10'] // Ethereum, Polygon, Arbitrum, Base, Optimism
    await this.getTokensForChains(commonChains)
  }

  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    this.tokenCache.clear()
    console.log('🧹 Cleared LiFi token cache')
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
export const lazyTokenLoader = new LazyTokenLoader()

// Backwards compatibility function
export async function getTokensByChain(chainId: ChainIdKey): Promise<Token[]> {
  return lazyTokenLoader.getTokensForChain(chainId)
}

// Preload common chains for better UX
if (typeof window === 'undefined') {
  // Only preload on server side to avoid blocking client
  lazyTokenLoader.preloadCommonChains().catch(console.error)
}
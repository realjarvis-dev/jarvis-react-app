import axios from 'axios'

// Cache for token lookups to avoid repeated API calls
const tokenCache = new Map<string, { value: string; timestamp: number }>()
const TOKEN_CACHE_TTL = 60 * 60 * 1000 // 1 hour
const MAX_TOKEN_CACHE_SIZE = 1000 // Limit cache size

export interface TokenInfo {
  decimals: number
  price: number
  symbol: string
  timestamp: number
  confidence: number
}

export interface DeFiLlamaTokenResponse {
  coins: {
    [key: string]: TokenInfo
  }
}

/**
 * Normalize chain names to match DeFiLlama API format
 */
function normalizeChainName(chain: string): string {
  const chainMap: Record<string, string> = {
    'ethereum': 'ethereum',
    'arbitrum': 'arbitrum',
    'arbitrum one': 'arbitrum',
    'polygon': 'polygon',
    'optimism': 'optimism',
    'base': 'base',
    'avalanche': 'avax',
    'bsc': 'bsc',
    'solana': 'solana',
    'fantom': 'fantom'
  }
  
  const normalized = chain.toLowerCase().trim()
  return chainMap[normalized] || normalized
}

/**
 * Lookup token information from DeFiLlama API
 * Format: ethereum:0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5
 */
export async function lookupToken(tokenAddress: string, chain: string = 'ethereum'): Promise<string | null> {
  const normalizedChain = normalizeChainName(chain)
  
  // Check cache first with TTL
  const cacheKey = `${normalizedChain}:${tokenAddress.toLowerCase()}`
  const cachedEntry = tokenCache.get(cacheKey)
  if (cachedEntry) {
    // Check if cache entry is still valid
    if (Date.now() - cachedEntry.timestamp < TOKEN_CACHE_TTL) {
      return cachedEntry.value
    } else {
      // Remove expired entry
      tokenCache.delete(cacheKey)
    }
  }

  try {
    const url = `https://coins.llama.fi/prices/current/${normalizedChain}:${tokenAddress}?searchWidth=4h`
    console.log(`🔍 Looking up token: ${cacheKey}`)
    
    const response = await axios.get<DeFiLlamaTokenResponse>(url, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DeFi-App/1.0'
      }
    })

    const tokenData = response.data.coins[cacheKey]
    if (tokenData?.symbol) {
      const symbol = tokenData.symbol.toUpperCase()
      console.log(`✅ Found token: ${cacheKey} = ${symbol}`)
      
      // Cache the result with TTL and size limit
      if (tokenCache.size >= MAX_TOKEN_CACHE_SIZE) {
        // Remove oldest entry
        const firstKey = tokenCache.keys().next().value
        if (firstKey) {
          tokenCache.delete(firstKey)
          console.log(`🧹 Evicted token cache entry: ${firstKey}`)
        }
      }
      
      tokenCache.set(cacheKey, { value: symbol, timestamp: Date.now() })
      return symbol
    }

    console.log(`❌ No symbol found for token: ${cacheKey}`)
    return null
  } catch (error) {
    console.warn(`⚠️ Failed to lookup token ${cacheKey}:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Batch lookup multiple tokens efficiently
 */
export async function lookupTokensBatch(tokens: { address: string; chain?: string }[]): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const unknownTokens: { address: string; chain: string; cacheKey: string }[] = []

  // First check cache
  for (const token of tokens) {
    const normalizedChain = normalizeChainName(token.chain || 'ethereum')
    const cacheKey = `${normalizedChain}:${token.address.toLowerCase()}`
    
    const cachedEntry = tokenCache.get(cacheKey)
    if (cachedEntry) {
      // Check if cache entry is still valid
      if (Date.now() - cachedEntry.timestamp < TOKEN_CACHE_TTL) {
        results.set(token.address, cachedEntry.value)
      } else {
        // Remove expired entry
        tokenCache.delete(cacheKey)
        unknownTokens.push({ address: token.address, chain: normalizedChain, cacheKey })
      }
    } else {
      unknownTokens.push({ address: token.address, chain: normalizedChain, cacheKey })
    }
  }

  // If all tokens are cached, return early
  if (unknownTokens.length === 0) {
    return results
  }

  try {
    // Batch API call for unknown tokens
    const tokenIds = unknownTokens.map(t => t.cacheKey).join(',')
    const url = `https://coins.llama.fi/prices/current/${tokenIds}?searchWidth=4h`
    
    console.log(`🔍 Batch lookup for ${unknownTokens.length} tokens`)
    
    const response = await axios.get<DeFiLlamaTokenResponse>(url, {
      timeout: 10000, // 10 second timeout for batch
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DeFi-App/1.0'
      }
    })

    // Process results
    for (const unknownToken of unknownTokens) {
      const tokenData = response.data.coins[unknownToken.cacheKey]
      if (tokenData?.symbol) {
        const symbol = tokenData.symbol.toUpperCase()
        results.set(unknownToken.address, symbol)
        tokenCache.set(unknownToken.cacheKey, { value: symbol, timestamp: Date.now() })
        console.log(`✅ Batch found: ${unknownToken.cacheKey} = ${symbol}`)
      }
    }

    console.log(`✅ Batch lookup completed: ${results.size}/${tokens.length} tokens resolved`)
  } catch (error) {
    console.warn('⚠️ Batch token lookup failed:', error instanceof Error ? error.message : error)
    
    // Fallback to individual lookups for critical tokens
    for (const unknownToken of unknownTokens.slice(0, 3)) { // Limit to 3 to avoid rate limits
      try {
        const symbol = await lookupToken(unknownToken.address, unknownToken.chain)
        if (symbol) {
          results.set(unknownToken.address, symbol)
        }
      } catch (e) {
        // Ignore individual failures in fallback
      }
    }
  }

  return results
}

/**
 * Get cached token count for monitoring
 */
export function getTokenCacheStats(): { size: number; entries: string[] } {
  return {
    size: tokenCache.size,
    entries: Array.from(tokenCache.keys()).slice(0, 10) // First 10 for debugging
  }
}

/**
 * Clear token cache (useful for testing or memory management)
 */
export function clearTokenCache(): void {
  tokenCache.clear()
  console.log('🧹 Token cache cleared')
}
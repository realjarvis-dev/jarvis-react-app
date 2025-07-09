import axios from 'axios'

// Cache for protocol lookups to avoid repeated API calls
const protocolCache = new Map<string, { value: string | null; timestamp: number }>()
const PROTOCOL_CACHE_TTL = 60 * 60 * 1000 // 1 hour
const MAX_PROTOCOL_CACHE_SIZE = 500 // Limit cache size

export interface DeFiLlamaProtocolData {
  id: string
  name: string
  address?: string
  symbol?: string
  url?: string
  description?: string
  chain?: string
  logo?: string
  audits?: string
  audit_note?: string
  gecko_id?: string
  cmcId?: string
  category?: string
  chains?: string[]
  module?: string
  twitter?: string
  forkedFrom?: string[]
  listedAt?: number
  methodology?: any
  slug?: string
  tvl?: number
  chainTvls?: any
  change_1h?: number
  change_1d?: number
  change_7d?: number
  tokenBreakdowns?: any
  mcap?: number
}

/**
 * Lookup protocol URL from DeFiLlama protocols API
 */
export async function lookupProtocolUrl(protocolName: string): Promise<string | null> {
  const normalizedName = protocolName.toLowerCase().trim()
  
  // Check cache first with TTL
  const cachedEntry = protocolCache.get(normalizedName)
  if (cachedEntry) {
    // Check if cache entry is still valid
    if (Date.now() - cachedEntry.timestamp < PROTOCOL_CACHE_TTL) {
      return cachedEntry.value
    } else {
      // Remove expired entry
      protocolCache.delete(normalizedName)
    }
  }

  try {
    console.log(`🔍 Looking up protocol: ${protocolName}`)
    
    // Get all protocols from DeFiLlama
    const response = await axios.get<DeFiLlamaProtocolData[]>('https://api.llama.fi/protocols', {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DeFi-App/1.0'
      }
    })

    // Find matching protocol
    const protocol = response.data.find(p => {
      const pName = p.name.toLowerCase()
      const pSlug = p.slug?.toLowerCase() || ''
      
      return (
        pName === normalizedName ||
        pSlug === normalizedName ||
        pName.includes(normalizedName) ||
        normalizedName.includes(pName) ||
        pSlug.includes(normalizedName)
      )
    })

    if (protocol?.url) {
      console.log(`✅ Found protocol URL: ${protocolName} = ${protocol.url}`)
      
      // Cache with size limit
      if (protocolCache.size >= MAX_PROTOCOL_CACHE_SIZE) {
        // Remove oldest entry
        const firstKey = protocolCache.keys().next().value
        if (firstKey) {
          protocolCache.delete(firstKey)
          console.log(`🧹 Evicted protocol cache entry: ${firstKey}`)
        }
      }
      
      protocolCache.set(normalizedName, { value: protocol.url, timestamp: Date.now() })
      return protocol.url
    }

    console.log(`❌ No URL found for protocol: ${protocolName}`)
    protocolCache.set(normalizedName, { value: null, timestamp: Date.now() })
    return null
  } catch (error) {
    console.warn(`⚠️ Failed to lookup protocol ${protocolName}:`, error instanceof Error ? error.message : error)
    protocolCache.set(normalizedName, { value: null, timestamp: Date.now() })
    return null
  }
}

/**
 * Batch lookup multiple protocols efficiently
 */
export async function lookupProtocolUrlsBatch(protocolNames: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  const unknownProtocols: string[] = []

  // First check cache
  for (const protocolName of protocolNames) {
    const normalizedName = protocolName.toLowerCase().trim()
    
    const cachedEntry = protocolCache.get(normalizedName)
    if (cachedEntry) {
      // Check if cache entry is still valid
      if (Date.now() - cachedEntry.timestamp < PROTOCOL_CACHE_TTL) {
        results.set(protocolName, cachedEntry.value)
      } else {
        // Remove expired entry
        protocolCache.delete(normalizedName)
        unknownProtocols.push(protocolName)
      }
    } else {
      unknownProtocols.push(protocolName)
    }
  }

  // If all protocols are cached, return early
  if (unknownProtocols.length === 0) {
    return results
  }

  try {
    console.log(`🔍 Batch lookup for ${unknownProtocols.length} protocols`)
    
    // Get all protocols from DeFiLlama (single API call for all)
    const response = await axios.get<DeFiLlamaProtocolData[]>('https://api.llama.fi/protocols', {
      timeout: 15000, // 15 second timeout for batch
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DeFi-App/1.0'
      }
    })

    // Process each unknown protocol
    for (const protocolName of unknownProtocols) {
      const normalizedName = protocolName.toLowerCase().trim()
      
      const protocol = response.data.find(p => {
        const pName = p.name.toLowerCase()
        const pSlug = p.slug?.toLowerCase() || ''
        
        return (
          pName === normalizedName ||
          pSlug === normalizedName ||
          pName.includes(normalizedName) ||
          normalizedName.includes(pName) ||
          pSlug.includes(normalizedName)
        )
      })

      if (protocol?.url) {
        results.set(protocolName, protocol.url)
        protocolCache.set(normalizedName, { value: protocol.url, timestamp: Date.now() })
        console.log(`✅ Batch found: ${protocolName} = ${protocol.url}`)
      } else {
        results.set(protocolName, null)
        protocolCache.set(normalizedName, { value: null, timestamp: Date.now() })
      }
    }

    console.log(`✅ Batch protocol lookup completed: ${Array.from(results.values()).filter(url => url !== null).length}/${protocolNames.length} protocols resolved`)
  } catch (error) {
    console.warn('⚠️ Batch protocol lookup failed:', error instanceof Error ? error.message : error)
    
    // Set remaining unknown protocols as null in results
    for (const protocolName of unknownProtocols) {
      if (!results.has(protocolName)) {
        results.set(protocolName, null)
        protocolCache.set(protocolName.toLowerCase().trim(), { value: null, timestamp: Date.now() })
      }
    }
  }

  return results
}

/**
 * Get cached protocol count for monitoring
 */
export function getProtocolCacheStats(): { size: number; entries: string[] } {
  return {
    size: protocolCache.size,
    entries: Array.from(protocolCache.keys()).slice(0, 10) // First 10 for debugging
  }
}

/**
 * Clear protocol cache (useful for testing or memory management)
 */
export function clearProtocolCache(): void {
  protocolCache.clear()
  console.log('🧹 Protocol cache cleared')
}
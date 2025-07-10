import Fuse from 'fuse.js'

export interface Protocol {
  name: string
  slug?: string
  symbol?: string
  category?: string
  tvl?: number
}

export interface ScoredProtocol extends Protocol {
  score: number
}

interface ScoredProtocolMatch {
  protocol: Protocol
  score: number
  exactNameMatch: number
  categoryRelevance: number
  tvlWeight: number
  totalScore: number
}

/**
 * Fuzzy protocol matcher using Fuse.js similar to token matcher
 */
export class ProtocolMatcher {
  private fuse: Fuse<Protocol>
  private protocols: Protocol[]

  constructor(protocols: Protocol[], threshold = 0.3) {
    this.protocols = protocols
    
    this.fuse = new Fuse(protocols, {
      keys: [
        { name: 'name', weight: 0.6 },
        { name: 'slug', weight: 0.4 },
        { name: 'symbol', weight: 0.3 }
      ],
      threshold: threshold,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true
    })
  }

  /**
   * Enhanced scoring function that combines Fuse.js scores with protocol-specific factors
   */
  private calculateEnhancedProtocolScore(
    protocol: Protocol,
    query: string,
    fuseScore: number
  ): ScoredProtocolMatch {
    const normalizedQuery = this.normalizeProtocolName(query)
    const protocolName = this.normalizeProtocolName(protocol.name || '')
    const protocolSlug = this.normalizeProtocolName(protocol.slug || '')
    
    // Exact name match bonus
    let exactNameMatch = 0
    if (protocolName === normalizedQuery || protocolSlug === normalizedQuery) {
      exactNameMatch = 0.5
    } else if (protocolName.includes(normalizedQuery) || protocolSlug.includes(normalizedQuery)) {
      exactNameMatch = 0.3
    } else if (normalizedQuery.includes(protocolName) || normalizedQuery.includes(protocolSlug)) {
      exactNameMatch = 0.2
    }
    
    // Category relevance for DeFi protocols
    let categoryRelevance = 0
    const defiCategories = ['lending', 'dex', 'yield', 'staking', 'liquid staking', 'derivatives']
    if (protocol.category && defiCategories.includes(protocol.category.toLowerCase())) {
      categoryRelevance = 0.1
    }
    
    // TVL weight (higher TVL protocols get slight preference)
    let tvlWeight = 0
    if (protocol.tvl && protocol.tvl > 1_000_000_000) { // > $1B TVL
      tvlWeight = 0.2
    } else if (protocol.tvl && protocol.tvl > 100_000_000) { // > $100M TVL
      tvlWeight = 0.1
    }
    
    const totalScore = (1 - fuseScore) * 0.3 + exactNameMatch + categoryRelevance + tvlWeight
    
    return {
      protocol,
      score: fuseScore,
      exactNameMatch,
      categoryRelevance,
      tvlWeight,
      totalScore
    }
  }

  /**
   * Normalize protocol names to handle common variations
   */
  private normalizeProtocolName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /**
   * Match protocols by name with fuzzy matching
   */
  match(query: string, limit = 5): ScoredProtocol[] {
    if (!query || query.trim().length < 2) {
      return []
    }

    // First try exact matches
    const normalizedQuery = this.normalizeProtocolName(query)
    const exactMatches = this.protocols.filter(protocol => {
      const normalizedName = this.normalizeProtocolName(protocol.name || '')
      const normalizedSlug = this.normalizeProtocolName(protocol.slug || '')
      return normalizedName === normalizedQuery || normalizedSlug === normalizedQuery
    })

    if (exactMatches.length > 0) {
      return exactMatches.slice(0, limit).map(protocol => ({
        ...protocol,
        score: 0
      }))
    }
    // Use fuzzy search for approximate matches
    const fuseResults = this.fuse.search(query, { limit: limit * 2 })
    
    if (fuseResults.length === 0) {
      return []
    }

    // Calculate enhanced scores
    const scoredMatches = fuseResults.map(result => 
      this.calculateEnhancedProtocolScore(result.item, query, result.score || 0)
    )
    
    // Sort by total score (descending)
    scoredMatches.sort((a, b) => b.totalScore - a.totalScore)
    
    return scoredMatches.slice(0, limit).map(match => ({
      ...match.protocol,
      score: match.score
    }))
  }

  /**
   * Find the best matching protocol
   */
  findBestMatch(query: string): Protocol | null {
    const matches = this.match(query, 1)
    return matches.length > 0 ? matches[0] : null
  }

  /**
   * Check if a protocol name matches the query
   */
  isMatch(protocolName: string, query: string, threshold = 0.6): boolean {
    const matches = this.match(query, 1)
    if (matches.length === 0) return false
    
    const bestMatch = matches[0]
    const normalizedProtocolName = this.normalizeProtocolName(protocolName)
    const normalizedBestMatch = this.normalizeProtocolName(bestMatch.name)
    
    return normalizedProtocolName === normalizedBestMatch || 
           (1 - bestMatch.score) >= threshold
  }
}

/**
 * Create a protocol matcher from yield data
 */
export function createProtocolMatcherFromYields(yields: Array<{ project: string }>): ProtocolMatcher {
  const uniqueProtocols = Array.from(
    new Set(yields.map(y => y.project))
  ).map(projectName => ({
    name: projectName,
    slug: projectName
  }))
  
  return new ProtocolMatcher(uniqueProtocols, 0.2)
}
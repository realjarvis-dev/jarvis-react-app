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

export type ScoredToken = Token & {
  score: number
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
   * @returns {ScoredToken[]}
   */
  match(query: string, limit = 5): ScoredToken[] {
    const normalizedQuery = query.toLowerCase().trim()
    
    if (!normalizedQuery) {
      return []
    }

    // Step 1: Find exact matches (symbol or name)
    const exactMatches: ScoredToken[] = []
    
    // Step 2: Find prefix matches
    const prefixMatches: ScoredToken[] = []
    
    // Step 3: Collect fuzzy matches (excluding exact and prefix matches)
    const fuzzyMatches: ScoredToken[] = []
    
    // Track tokens we've already matched to avoid duplicates
    const matchedAddresses = new Set<string>()
    
    for (const token of this.tokenList) {
      const normalizedSymbol = token.symbol.toLowerCase()
      const normalizedName = token.name.toLowerCase()
      
      // Exact match check
      if (normalizedSymbol === normalizedQuery || normalizedName === normalizedQuery) {
        exactMatches.push({ ...token, score: 0 })
        matchedAddresses.add(token.address)
        continue
      }
      
      // Special handling for multi-word queries - check if all words match
      const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0)
      if (queryWords.length > 1) {
        const symbolWords = normalizedSymbol.split(/[-\s]+/).filter(word => word.length > 0)
        const nameWords = normalizedName.split(/[-\s]+/).filter(word => word.length > 0)
        
        // Check if all query words are found in symbol or name
        const allWordsInSymbol = queryWords.every(queryWord => 
          symbolWords.some(symbolWord => symbolWord.includes(queryWord))
        )
        const allWordsInName = queryWords.every(queryWord => 
          nameWords.some(nameWord => nameWord.includes(queryWord))
        )
        
        if (allWordsInSymbol || allWordsInName) {
          // Calculate a more precise score based on how well the words match
          let wordMatchScore = 0
          
          // Prefer exact word matches over partial matches
          const exactWordMatches = queryWords.filter(queryWord => 
            symbolWords.includes(queryWord) || nameWords.includes(queryWord)
          ).length
          
          // Bonus for exact word matches, penalty for partial matches
          wordMatchScore = exactWordMatches / queryWords.length
          
          // Special bonus if the token name/symbol contains the exact query words in order
          const queryString = queryWords.join('')
          const symbolString = symbolWords.join('')
          const nameString = nameWords.join('')
          
          if (symbolString.includes(queryString) || nameString.includes(queryString)) {
            wordMatchScore += 0.1 // Small bonus for word order match
          }
          
          exactMatches.push({ ...token, score: 0.05 - wordMatchScore * 0.05 })
          matchedAddresses.add(token.address)
          continue
        }
      }
      
      // Prefix match check (starts with query)
      if (normalizedSymbol.startsWith(normalizedQuery) || normalizedName.startsWith(normalizedQuery)) {
        prefixMatches.push({ ...token, score: 0.1 })
        matchedAddresses.add(token.address)
        continue
      }
    }
    
    // Get fuzzy matches, excluding already matched tokens
    const fuseResults = this.fuse.search(normalizedQuery, { limit: limit * 2 })
    
    for (const { item, score } of fuseResults) {
      if (!matchedAddresses.has(item.address)) {
        // Additional filtering: avoid misleading substring matches
        const normalizedSymbol = item.symbol.toLowerCase()
        const normalizedName = item.name.toLowerCase()
        
        // Skip if query appears in middle of a much longer string (potential false positive)
        const symbolIndex = normalizedSymbol.indexOf(normalizedQuery)
        const nameIndex = normalizedName.indexOf(normalizedQuery)
        
        // Allow fuzzy match if:
        // 1. It's a reasonable fuzzy match (score < 0.6)
        // 2. If query appears in middle, the containing string shouldn't be much longer
        const isReasonableFuzzyMatch = (score || 0) < 0.6
        const isReasonableSubstring = 
          (symbolIndex === -1 || normalizedSymbol.length <= normalizedQuery.length * 2) &&
          (nameIndex === -1 || normalizedName.length <= normalizedQuery.length * 2)
        
        if (isReasonableFuzzyMatch && isReasonableSubstring) {
          fuzzyMatches.push({ ...item, score: score || 0 })
        }
      }
    }
    
    // Combine results: exact matches first, then prefix matches, then fuzzy matches
    const allMatches = [
      ...exactMatches.sort((a, b) => a.score - b.score),
      ...prefixMatches.sort((a, b) => a.score - b.score),
      ...fuzzyMatches.sort((a, b) => a.score - b.score)
    ]
    
    return allMatches.slice(0, limit)
  }
}

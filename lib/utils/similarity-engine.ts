'use client'

import Fuse from 'fuse.js'

export interface SimilarityResult {
  score: number
  semanticSimilarity: number
  lexicalSimilarity: number
  isSimilar: boolean
  isRedundant: boolean
}

/**
 * Intelligent similarity engine for autocomplete suggestions
 * Uses fuzzy matching and semantic analysis to determine suggestion relevance
 */
export class SimilarityEngine {
  private fuse: Fuse<string>
  
  // Semantic word groups for better similarity detection
  private semanticGroups = {
    yieldTerms: ['yield', 'earn', 'farm', 'farming', 'vault', 'vaults', 'stake', 'staking', 'rewards', 'apy', 'apr'],
    findTerms: ['find', 'discover', 'search', 'explore', 'lookup', 'locate', 'get', 'show'],
    opportunityTerms: ['opportunities', 'options', 'pools', 'positions', 'strategies', 'investments'],
    checkTerms: ['check', 'view', 'see', 'look', 'examine', 'inspect', 'verify'],
    walletTerms: ['wallet', 'balance', 'balances', 'portfolio', 'holdings', 'assets'],
    swapTerms: ['swap', 'trade', 'exchange', 'convert', 'buy', 'sell'],
    bridgeTerms: ['bridge', 'transfer', 'move', 'send', 'cross-chain'],
    protocolTerms: ['protocol', 'platform', 'dapp', 'application', 'service'],
    tokenTerms: ['token', 'tokens', 'coin', 'coins', 'crypto', 'asset', 'assets'],
    priceTerms: ['price', 'prices', 'cost', 'value', 'worth', 'rate', 'rates'],
    gasTerms: ['gas', 'fee', 'fees', 'cost', 'costs', 'transaction']
  }
  
  constructor() {
    // Initialize Fuse for fuzzy search
    this.fuse = new Fuse([], {
      includeScore: true,
      threshold: 0.6,
      distance: 100,
      minMatchCharLength: 2,
      keys: ['text']
    })
  }
  
  /**
   * Calculate similarity between user input and suggestion
   */
  calculateSimilarity(userInput: string, suggestion: string): SimilarityResult {
    const cleanInput = this.cleanText(userInput)
    const cleanSuggestion = this.cleanText(suggestion)
    
    // Calculate lexical similarity using edit distance
    const lexicalSimilarity = this.calculateLexicalSimilarity(cleanInput, cleanSuggestion)
    
    // Calculate semantic similarity using word groups
    const semanticSimilarity = this.calculateSemanticSimilarity(cleanInput, cleanSuggestion)
    
    // Combine scores with weights
    const score = (lexicalSimilarity * 0.4) + (semanticSimilarity * 0.6)
    
    // Determine if suggestions are similar/redundant
    const isSimilar = score > 0.7
    const isRedundant = score > 0.8 || this.isRedundantSuggestion(cleanInput, cleanSuggestion)
    
    return {
      score,
      semanticSimilarity,
      lexicalSimilarity,
      isSimilar,
      isRedundant
    }
  }
  
  /**
   * Clean and normalize text for comparison
   */
  private cleanText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  
  /**
   * Calculate lexical similarity using Levenshtein distance
   */
  private calculateLexicalSimilarity(text1: string, text2: string): number {
    const distance = this.levenshteinDistance(text1, text2)
    const maxLength = Math.max(text1.length, text2.length)
    return maxLength === 0 ? 1 : 1 - (distance / maxLength)
  }
  
  /**
   * Calculate semantic similarity using word groups
   */
  private calculateSemanticSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/)
    const words2 = text2.split(/\s+/)
    
    let matchScore = 0
    let totalWords = Math.max(words1.length, words2.length)
    
    // Check for exact word matches
    for (const word1 of words1) {
      if (words2.includes(word1)) {
        matchScore += 1
      }
    }
    
    // Check for semantic group matches
    for (const [groupName, group] of Object.entries(this.semanticGroups)) {
      const hasGroup1 = words1.some(word => group.includes(word))
      const hasGroup2 = words2.some(word => group.includes(word))
      
      if (hasGroup1 && hasGroup2) {
        matchScore += 0.8 // High score for semantic group matches
      }
    }
    
    // Check for partial matches and synonyms
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 !== word2 && this.areWordsSimilar(word1, word2)) {
          matchScore += 0.5
        }
      }
    }
    
    return totalWords === 0 ? 0 : Math.min(matchScore / totalWords, 1)
  }
  
  /**
   * Check if two words are semantically similar
   */
  private areWordsSimilar(word1: string, word2: string): boolean {
    // Check if words belong to the same semantic group
    for (const group of Object.values(this.semanticGroups)) {
      if (group.includes(word1) && group.includes(word2)) {
        return true
      }
    }
    
    // Check for substring matches (plurals, etc.)
    if (word1.includes(word2) || word2.includes(word1)) {
      return true
    }
    
    return false
  }
  
  /**
   * Check if a suggestion is redundant based on patterns
   */
  private isRedundantSuggestion(input: string, suggestion: string): boolean {
    const inputWords = input.split(/\s+/)
    const suggestionWords = suggestion.split(/\s+/)
    
    // Pattern 1: "Find X opportunities" vs "Find Y opportunities"
    if (this.matchesPattern(inputWords, ['find', '*', 'opportunities']) &&
        this.matchesPattern(suggestionWords, ['find', '*', 'opportunities'])) {
      return true
    }
    
    // Pattern 2: "Check X balance" vs "Check Y balance"  
    if (this.matchesPattern(inputWords, ['check', '*', 'balance']) &&
        this.matchesPattern(suggestionWords, ['check', '*', 'balance'])) {
      return true
    }
    
    // Pattern 3: "Swap X for Y" vs "Swap A for B"
    if (this.matchesPattern(inputWords, ['swap', '*', 'for', '*']) &&
        this.matchesPattern(suggestionWords, ['swap', '*', 'for', '*'])) {
      return true
    }
    
    // Pattern 4: Same action with different protocols
    const actions = ['find', 'check', 'show', 'get', 'view']
    const protocols = ['uniswap', 'aave', 'compound', 'pendle', 'kodiak', 'makerdao']
    
    for (const action of actions) {
      if (inputWords.includes(action) && suggestionWords.includes(action)) {
        const inputProtocol = inputWords.find(word => protocols.includes(word))
        const suggestionProtocol = suggestionWords.find(word => protocols.includes(word))
        
        if (inputProtocol && suggestionProtocol && inputProtocol !== suggestionProtocol) {
          // Check if they're asking for the same type of thing from different protocols
          const hasOpportunities = inputWords.includes('opportunities') && suggestionWords.includes('opportunities')
          const hasYield = this.hasSemanticGroup(inputWords, 'yieldTerms') && this.hasSemanticGroup(suggestionWords, 'yieldTerms')
          
          if (hasOpportunities || hasYield) {
            return true
          }
        }
      }
    }
    
    return false
  }
  
  /**
   * Check if words match a pattern (* is wildcard)
   */
  private matchesPattern(words: string[], pattern: string[]): boolean {
    if (pattern.length > words.length) return false
    
    let wordIndex = 0
    for (const patternWord of pattern) {
      if (patternWord === '*') {
        wordIndex++
      } else {
        const found = words.slice(wordIndex).indexOf(patternWord)
        if (found === -1) return false
        wordIndex += found + 1
      }
    }
    
    return true
  }
  
  /**
   * Check if words contain any term from a semantic group
   */
  private hasSemanticGroup(words: string[], groupName: keyof typeof this.semanticGroups): boolean {
    const group = this.semanticGroups[groupName]
    return words.some(word => group.includes(word))
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }
  
  /**
   * Filter suggestions based on similarity to avoid redundancy
   */
  filterSuggestions(userInput: string, suggestions: any[]): any[] {
    const filtered: any[] = []
    const seen = new Set<string>()
    
    for (const suggestion of suggestions) {
      const similarity = this.calculateSimilarity(userInput, suggestion.text)
      
      // Skip if redundant
      if (similarity.isRedundant) {
        continue
      }
      
      // Check against already filtered suggestions
      let shouldSkip = false
      for (const existingSuggestion of filtered) {
        const crossSimilarity = this.calculateSimilarity(suggestion.text, existingSuggestion.text)
        if (crossSimilarity.isRedundant) {
          shouldSkip = true
          break
        }
      }
      
      if (!shouldSkip && !seen.has(suggestion.text)) {
        // Add similarity score to suggestion for ranking
        suggestion.similarityScore = similarity.score
        filtered.push(suggestion)
        seen.add(suggestion.text)
      }
    }
    
    return filtered
  }
  
  /**
   * Rank suggestions based on relevance and diversity
   */
  rankSuggestions(userInput: string, suggestions: any[]): any[] {
    return suggestions
      .map(suggestion => {
        const similarity = this.calculateSimilarity(userInput, suggestion.text)
        
        // Calculate final score combining original score and similarity
        const originalScore = suggestion.score || 0
        const relevanceBonus = similarity.score * 20 // Boost relevant suggestions
        const diversityPenalty = similarity.isRedundant ? -50 : 0
        
        return {
          ...suggestion,
          finalScore: originalScore + relevanceBonus + diversityPenalty,
          similarityScore: similarity.score,
          isRedundant: similarity.isRedundant
        }
      })
      .filter(suggestion => !suggestion.isRedundant)
      .sort((a, b) => b.finalScore - a.finalScore)
  }
}

/**
 * Create similarity engine instance
 */
export function createSimilarityEngine(): SimilarityEngine {
  return new SimilarityEngine()
}
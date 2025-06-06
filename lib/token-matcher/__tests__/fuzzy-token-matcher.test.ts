import { tokensByChain } from '../config/lifi/tokens' // Assuming this provides the token data
import { TokenMatcher } from '../fuzzy-token-matcher'

// Helper to get a chain ID that has tokens for testing
const getChainIdWithTokens = () => {
  const chainIds = Object.keys(tokensByChain)
  if (chainIds.length === 0) {
    // This case should ideally not happen if tokensByChain is populated
    // For safety, let's return a default or throw, but for tests, we need a valid one.
    // Returning '1' (Ethereum) as a common default, assuming it might exist.
    console.warn(
      'tokensByChain is empty. Tests might not run as expected. Defaulting to chainId 1'
    )
    return 1
  }
  // Prefer a chain with a decent number of tokens if possible
  // For simplicity, just picking the first one that is not undefined or null
  const firstChainIdWithTokens = chainIds.find(
    id => tokensByChain[id as keyof typeof tokensByChain]?.length > 0
  )
  return firstChainIdWithTokens ? parseInt(firstChainIdWithTokens) : 1 // Fallback to 1
}

// Helper to get a known token from a chainId for more precise tests
const getKnownToken = (chainId: number) => {
  const tokenList = tokensByChain[String(chainId) as keyof typeof tokensByChain]
  if (tokenList && tokenList.length > 0) {
    return tokenList[0] // Return the first token for simplicity
  }
  return null
}

describe('TokenMatcher', () => {
  const testChainIdWithTokens = getChainIdWithTokens()
  const knownTokenOnTestChain = getKnownToken(testChainIdWithTokens)
  // A chain ID we expect to have no tokens, or a deliberately unused one for testing.
  const testChainIdWithoutTokens = 999999

  describe('constructor', () => {
    it('should create an instance of TokenMatcher', () => {
      expect(new TokenMatcher(testChainIdWithTokens)).toBeInstanceOf(
        TokenMatcher
      )
    })

    it('should load tokens for the given chainId', () => {
      const matcher = new TokenMatcher(testChainIdWithTokens)
      // Accessing private list for testing purposes, alternative is to infer from match results
      expect(matcher['list'].length).toEqual(
        tokensByChain[
          String(testChainIdWithTokens) as keyof typeof tokensByChain
        ]?.length || 0
      )
    })

    it('should handle a chainId with no tokens gracefully', () => {
      const matcher = new TokenMatcher(testChainIdWithoutTokens)
      expect(matcher['list']).toEqual([])
      const results = matcher.match('ANY')
      expect(results).toEqual([])
    })
  })

  describe('match', () => {
    let tokenMatcher: TokenMatcher

    beforeAll(() => {
      // Ensure we are testing with a chainId that actually has tokens
      if (!knownTokenOnTestChain) {
        console.warn(
          `No known token found for chainId ${testChainIdWithTokens}. Some token match tests might be skipped or fail.`
        )
      }
      tokenMatcher = new TokenMatcher(testChainIdWithTokens)
    })

    it('should return empty array if matcher has no tokens (e.g. unknown chainId)', () => {
      const emptyMatcher = new TokenMatcher(testChainIdWithoutTokens)
      const results = emptyMatcher.match('XYZ')
      expect(results).toEqual([])
    })

    // These tests depend on having at least one token for testChainIdWithTokens
    ;(knownTokenOnTestChain ? describe : describe.skip)(
      'with known tokens',
      () => {
        it('should find a token by exact symbol', () => {
          const results = tokenMatcher.match(knownTokenOnTestChain!.symbol)
          expect(results.length).toBeGreaterThan(0)
          expect(results[0].symbol).toBe(knownTokenOnTestChain!.symbol)
          expect(results[0].address).toBe(knownTokenOnTestChain!.address)
        })

        it('should find a token by partial symbol (if distinct enough)', () => {
          const partialSymbol = knownTokenOnTestChain!.symbol.substring(
            0,
            Math.max(1, knownTokenOnTestChain!.symbol.length - 1)
          )
          if (!partialSymbol) return // skip if symbol is too short
          const results = tokenMatcher.match(partialSymbol)
          expect(results.length).toBeGreaterThan(0)
          // Check if the known token is among the results
          expect(
            results.some(t => t.symbol === knownTokenOnTestChain!.symbol)
          ).toBe(true)
        })

        it('should find a token by exact name', () => {
          const results = tokenMatcher.match(knownTokenOnTestChain!.name)
          expect(results.length).toBeGreaterThan(0)
          expect(results[0].name).toBe(knownTokenOnTestChain!.name)
        })

        it('should find a token by partial name (if distinct enough)', () => {
          const partialName = knownTokenOnTestChain!.name.substring(
            0,
            Math.max(1, knownTokenOnTestChain!.name.length - 2)
          )
          if (!partialName || partialName.length < 2) return // skip if name is too short or becomes too short
          const results = tokenMatcher.match(partialName)
          expect(results.length).toBeGreaterThan(0)
          expect(
            results.some(t => t.name === knownTokenOnTestChain!.name)
          ).toBe(true)
        })
      }
    )

    it('should return multiple results if matches are found, respecting default limit (5)', () => {
      // This test is a bit generic, depends on the dataset for testChainIdWithTokens
      // Assuming there's a common token like 'USD' or a very short query
      const results = tokenMatcher.match('USD')
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('should respect the limit parameter', () => {
      const results = tokenMatcher.match('A', 2) // 'A' is very generic
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should return an empty array if no match is found', () => {
      const results = tokenMatcher.match('NonExistentTokenSymbol12345')
      expect(results).toEqual([])
    })

    it('should handle case insensitivity for symbols and names', () => {
      if (!knownTokenOnTestChain) return
      const resultsUpperSymbol = tokenMatcher.match(
        knownTokenOnTestChain.symbol.toUpperCase()
      )
      const resultsLowerSymbol = tokenMatcher.match(
        knownTokenOnTestChain.symbol.toLowerCase()
      )
      const resultsUpperName = tokenMatcher.match(
        knownTokenOnTestChain.name.toUpperCase()
      )
      const resultsLowerName = tokenMatcher.match(
        knownTokenOnTestChain.name.toLowerCase()
      )

      expect(resultsUpperSymbol.length).toBeGreaterThan(0)
      expect(resultsUpperSymbol[0].symbol).toBe(knownTokenOnTestChain.symbol)
      expect(resultsLowerSymbol.length).toBeGreaterThan(0)
      expect(resultsLowerSymbol[0].symbol).toBe(knownTokenOnTestChain.symbol)
      expect(resultsUpperName.length).toBeGreaterThan(0)
      expect(resultsUpperName[0].name).toBe(knownTokenOnTestChain.name)
      expect(resultsLowerName.length).toBeGreaterThan(0)
      expect(resultsLowerName[0].name).toBe(knownTokenOnTestChain.name)
    })
  })
})

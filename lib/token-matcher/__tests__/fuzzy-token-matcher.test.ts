import { tokensByChain } from '../config/lifi/tokens'; // Assuming this provides the token data
import { TokenMatcher } from '../fuzzy-token-matcher';

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
      // The token list now includes both LiFi tokens and Pendle tokens, so it should be >= LiFi tokens count
      const lifiTokensCount = tokensByChain[
        String(testChainIdWithTokens) as keyof typeof tokensByChain
      ]?.length || 0
      expect(matcher['tokenList'].length).toBeGreaterThanOrEqual(lifiTokensCount)
    })

    it('should handle a chainId with no tokens gracefully', () => {
      const matcher = new TokenMatcher(testChainIdWithoutTokens)
      expect(matcher['tokenList']).toEqual([])
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

    it('should prioritize exact matches over fuzzy matches', () => {
      // Create a test token list with both "yUSD" and "syUSD" tokens
      const testTokens = [
        {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          symbol: 'yyDAI+yUSDC+yUSDT+yTUSD',
          name: 'yUSD',
          decimals: 18
        },
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'syUSD',
          name: 'Synnax Stablecoin',
          decimals: 18
        }
      ]
      
      const testMatcher = new TokenMatcher(1, 0.3, testTokens)
      const results = testMatcher.match('yUSD')
      
      // The token with name "yUSD" should be first (exact name match)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toBe('yUSD')
      expect(results[0].score).toBe(0) // Exact match should have score 0
    })

    it('should prioritize prefix matches over substring matches', () => {
      const testTokens = [
        {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          symbol: 'USDCoin',
          name: 'USD Coin',
          decimals: 6
        },
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'syUSDC',
          name: 'Synthetic USDC',
          decimals: 18
        }
      ]
      
      const testMatcher = new TokenMatcher(1, 0.3, testTokens)
      const results = testMatcher.match('USDC')
      
      // USDCoin should come before syUSDC because it's a prefix match
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].symbol).toBe('USDCoin')
      expect(results[0].score).toBe(0.1) // Prefix match score
    })

    it('should filter out misleading substring matches', () => {
      const testTokens = [
        {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          symbol: 'ABC',
          name: 'ABC Token',
          decimals: 18
        },
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'VeryLongTokenNameWithABCInTheMiddle',
          name: 'Very Long Token Name',
          decimals: 18
        }
      ]
      
      const testMatcher = new TokenMatcher(1, 0.3, testTokens)
      const results = testMatcher.match('ABC')
      
      // Should prioritize exact match and filter out misleading substring
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].symbol).toBe('ABC')
      
      // The long token name should be filtered out or ranked much lower
      const longTokenResult = results.find(r => r.symbol === 'VeryLongTokenNameWithABCInTheMiddle')
      expect(longTokenResult).toBeUndefined()
    })

    it('should handle empty or whitespace queries gracefully', () => {
      const results1 = tokenMatcher.match('')
      const results2 = tokenMatcher.match('   ')
      const results3 = tokenMatcher.match('\t\n')
      
      expect(results1).toEqual([])
      expect(results2).toEqual([])
      expect(results3).toEqual([])
    })

    it('should maintain correct scoring order within each match type', () => {
      const testTokens = [
        {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          symbol: 'USD',
          name: 'US Dollar',
          decimals: 18
        },
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6
        },
        {
          chainId: 1,
          address: '0x3333333333333333333333333333333333333333',
          symbol: 'USDT',
          name: 'USD Tether',
          decimals: 6
        }
      ]
      
      const testMatcher = new TokenMatcher(1, 0.3, testTokens)
      const results = testMatcher.match('USD')
      
      // Should have exact match first, then prefix matches
      expect(results.length).toBe(3)
      expect(results[0].symbol).toBe('USD') // Exact match
      expect(results[0].score).toBe(0)
      
      // Next two should be prefix matches with score 0.1
      expect(results[1].score).toBe(0.1)
      expect(results[2].score).toBe(0.1)
      expect(['USDC', 'USDT']).toContain(results[1].symbol)
      expect(['USDC', 'USDT']).toContain(results[2].symbol)
    })

    it('should correctly prioritize yUSD PT over sYUSD PT for multi-word queries', () => {
      const testTokens = [
        {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          symbol: 'PT-yUSD-27NOV2025',
          name: 'PT yUSD 27NOV2025',
          decimals: 18
        },
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          symbol: 'PT-sYUSD-04SEP2025',
          name: 'PT sYUSD 04SEP2025',
          decimals: 18
        },
        {
          chainId: 1,
          address: '0x3333333333333333333333333333333333333333',
          symbol: 'PT-vyUSD-27NOV2025',
          name: 'PT vyUSD 27NOV2025',
          decimals: 18
        }
      ]
      
      const testMatcher = new TokenMatcher(1, 0.3, testTokens)
      
      // Test "yUSD PT" query
      const results1 = testMatcher.match('yUSD PT')
      expect(results1.length).toBeGreaterThan(0)
      expect(results1[0].name).toBe('PT yUSD 27NOV2025')
      expect(results1[0].score).toBeLessThan(0.01) // Should have very low score (high priority)
      
      // Test "PT yUSD" query
      const results2 = testMatcher.match('PT yUSD')
      expect(results2.length).toBeGreaterThan(0)
      expect(results2[0].name).toBe('PT yUSD 27NOV2025')
      expect(results2[0].score).toBeLessThan(0.01) // Should have very low score (high priority)
      
      // Ensure sYUSD appears later in results if at all
      const sYUSDIndex = results2.findIndex(token => token.name.includes('PT sYUSD'))
      const yUSDIndex = results2.findIndex(token => token.name.includes('PT yUSD'))
      expect(yUSDIndex).toBe(0) // yUSD should be first
      if (sYUSDIndex !== -1) {
        expect(sYUSDIndex).toBeGreaterThan(yUSDIndex) // sYUSD should come after yUSD if present
      }
    })
  })
})

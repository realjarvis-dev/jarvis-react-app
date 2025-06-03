import { chains } from '../config/lifi/chains' // Assuming this is the source of truth
import { ChainMatcher } from '../fuzzy-chain-matcher'

describe('ChainMatcher', () => {
  let chainMatcher: ChainMatcher

  beforeAll(() => {
    // Use a subset of chains for predictable testing if needed, or all chains
    chainMatcher = new ChainMatcher()
  })

  describe('constructor', () => {
    it('should create an instance of ChainMatcher', () => {
      expect(new ChainMatcher()).toBeInstanceOf(ChainMatcher)
    })

    it('should use the provided chain list and threshold', () => {
      const customChains = [
        {
          id: 999,
          name: 'TestChain',
          coin: 'TC',
          key: 'testchain',
          chainType: 'test',
          mainnet: false
        }
      ]
      const matcherWithCustomChains = new ChainMatcher(customChains, 0.1)
      const results = matcherWithCustomChains.match('TestChain')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toBe('TestChain')
      // To test the threshold effect, we might check if a normally excluded item (with default threshold) is included
      // Or check the score of the matched item if the threshold affects it. For this, we need a specific scenario.
      // For now, just ensuring it runs with custom chains and threshold.
      // If testing score specifically for this instance:
      // results.forEach(r => expect(r.score).toBeLessThanOrEqual(0.1));
    })
  })

  describe('match', () => {
    it('should find a chain by exact name', () => {
      const results = chainMatcher.match('Ethereum')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toBe('Ethereum')
      expect(results[0].id).toBe(1)
    })

    it('should find a chain by partial name', () => {
      const results = chainMatcher.match('Eth')
      // This depends on the fuse.js scoring and threshold,
      // so we check if "Ethereum" is among the top results if not the first.
      expect(results.some(chain => chain.name === 'Ethereum')).toBe(true)
    })

    it('should find a chain by coin symbol', () => {
      const results = chainMatcher.match('BNB')
      expect(results.length).toBeGreaterThan(0)
      const bscMatch = results.find(r => r.name === 'BSC')
      expect(bscMatch).toBeDefined()
      expect(bscMatch?.id).toBe(56)
    })

    it('should find a chain by ID', () => {
      const results = chainMatcher.match('42161')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toBe('Arbitrum')
    })

    it('should return multiple results if matches are found, respecting default limit', () => {
      const results = chainMatcher.match('Poly') // Should match Polygon, Polygon zkEVM
      expect(results.length).toBeGreaterThanOrEqual(1) // at least one
      expect(results.length).toBeLessThanOrEqual(3) // default limit is 3
    })

    it('should respect the limit parameter', () => {
      const results = chainMatcher.match('a', 5) // 'a' is very generic
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('should return an empty array if no match is found', () => {
      const results = chainMatcher.match('NonExistentChain123')
      expect(results).toEqual([])
    })

    it('should handle case insensitivity (inherent in Fuse.js default settings)', () => {
      const resultsUpper = chainMatcher.match('ETHEREUM')
      const resultsLower = chainMatcher.match('ethereum')
      expect(resultsUpper.length).toBeGreaterThan(0)
      expect(resultsUpper[0].name).toBe('Ethereum')
      expect(resultsLower.length).toBeGreaterThan(0)
      expect(resultsLower[0].name).toBe('Ethereum')
    })

    it('should provide a score for each match', () => {
      const results = chainMatcher.match('Ethereum')
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.score).toBeDefined()
        expect(typeof result.score).toBe('number')
        expect(result.score).toBeGreaterThanOrEqual(0)
        // Fuse.js score: 0 = perfect match, 1 = complete mismatch
        // chainMatcher uses the default threshold of 0.3
        expect(result.score).toBeLessThanOrEqual(0.3)
      })
    })

    it('should work with chains having special characters or numbers in name if they exist', () => {
      // Add a dummy chain with special chars to the list for this test if not present
      const specialMatcher = new ChainMatcher([
        ...chains,
        {
          id: 1000,
          name: 'Chain-123!',
          coin: 'C123',
          key: 'chain123',
          chainType: 'test',
          mainnet: false
        }
      ])
      const results = specialMatcher.match('Chain-123!')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toBe('Chain-123!')
    })
  })
})

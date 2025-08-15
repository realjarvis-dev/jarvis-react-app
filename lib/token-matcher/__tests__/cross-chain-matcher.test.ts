import {
  crossChainMatcher, // Import the actual singleton instance
  MissingChainError,
  MissingTokenError
} from '../cross-chain-matcher'
import { ChainMatcher, type Chain } from '../fuzzy-chain-matcher'
import { TokenMatcher, type Token } from '../fuzzy-token-matcher'

// Mock the dependent matcher classes
jest.mock('../fuzzy-chain-matcher')
jest.mock('../fuzzy-token-matcher')

const MockedChainMatcher = ChainMatcher as jest.MockedClass<typeof ChainMatcher>
const MockedTokenMatcher = TokenMatcher as jest.MockedClass<typeof TokenMatcher>

describe('CrossChainMatcher Singleton', () => {
  // This is the actual singleton instance we are testing
  const matcherInstance = crossChainMatcher

  let internalChainMatcherMock: jest.Mocked<ChainMatcher>
  let mockTokenMatchFn: jest.Mock

  beforeEach(() => {
    // Reset all mocks
    MockedChainMatcher.mockClear()
    MockedTokenMatcher.mockClear()

    // 1. Setup ChainMatcher mock
    // The CrossChainMatcher singleton creates its own ChainMatcher instance internally.
    // We need to access that specific mock instance and control its 'match' method.
    // (matcherInstance as any) allows access to private 'matcher' property for testing.
    internalChainMatcherMock = (matcherInstance as any)
      .matcher as jest.Mocked<ChainMatcher>
    if (
      !internalChainMatcherMock ||
      !jest.isMockFunction(internalChainMatcherMock.match)
    ) {
      // This would indicate a problem with how jest.mock set up ChainMatcher
      // or how the singleton initializes it. For robust testing, ensure it's a mock.
      // If it's not a mock, re-assign:
      ;(matcherInstance as any).matcher = new MockedChainMatcher()
      internalChainMatcherMock = (matcherInstance as any).matcher
    }
    // Ensure 'match' is a Jest mock function if it wasn't automatically by jest.mock
    if (!jest.isMockFunction(internalChainMatcherMock.match)) {
      internalChainMatcherMock.match = jest.fn()
    }

    // 2. Setup TokenMatcher mock
    // CrossChainMatcher creates TokenMatcher instances dynamically via `new TokenMatcher(chainId)`.
    // We mock the TokenMatcher constructor to return instances that use our shared `mockTokenMatchFn`.
    // These instances will also store their `chainId` for conditional logic in the mock.
    mockTokenMatchFn = jest.fn()
    MockedTokenMatcher.mockImplementation((chainId: number) => {
      return {
        match: mockTokenMatchFn,
        chainId: chainId // Store chainId on the mock instance
      } as unknown as jest.Mocked<TokenMatcher>
    })

    // Clear the singleton's internal tokenMatcherMap for test isolation,
    // as it caches TokenMatcher instances.
    ;(matcherInstance as any).tokenMatcherMap.clear()
  })

  describe('getInstance', () => {
    it('should return the same singleton instance', () => {
      // Require it again or get it from the import
      const instance1 = crossChainMatcher
      const instance2 = require('../cross-chain-matcher').crossChainMatcher
      expect(instance1).toBe(instance2)
      expect(instance1).toBe(matcherInstance)
    })
  })

  describe('fuzzyIntentDetect', () => {
    const fromChainStr = 'ethereum'
    const toChainStr = 'polygon'
    const fromTokenStr = 'eth'
    const toTokenStr = 'matic'

    const mockFromChain: Chain = {
      id: 1,
      name: 'Ethereum',
      coin: 'ETH'
    }
    const mockToChain: Chain = {
      id: 137,
      name: 'Polygon',
      coin: 'POL'
    } // Corrected coin

    const mockFromTokenExact: Token = {
      chainId: 1,
      address: '0xfrom',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18
    }
    const mockFromTokenFuzzyList: Token[] = [
      mockFromTokenExact,
      {
        chainId: 1,
        address: '0xfrom_fuzzy',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18
      }
    ]
    const mockToTokenExact: Token = {
      chainId: 137,
      address: '0xto',
      symbol: 'MATIC',
      name: 'Matic Token',
      decimals: 18
    }
    const mockToTokenFuzzyList: Token[] = [
      mockToTokenExact,
      {
        chainId: 137,
        address: '0xto_fuzzy',
        symbol: 'WMATIC',
        name: 'Wrapped Matic',
        decimals: 18      }
    ]

    it('should correctly detect chains and tokens with exact matches', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [mockFromChain]
        if (query === toChainStr) return [mockToChain]
        return []
      })

      // `this` in mockTokenMatchFn will be the mock TokenMatcher instance
      mockTokenMatchFn.mockImplementation(function (
        this: { chainId: number },
        query: string
      ) {
        if (
          this.chainId === mockFromChain.id &&
          query.toLowerCase() === fromTokenStr.toLowerCase()
        )
          return [mockFromTokenExact]
        if (
          this.chainId === mockToChain.id &&
          query.toLowerCase() === toTokenStr.toLowerCase()
        )
          return [mockToTokenExact]
        return []
      })

      const result = await matcherInstance.fuzzyIntentDetect(
        fromChainStr,
        toChainStr,
        fromTokenStr,
        toTokenStr
      )

      expect(result.fromChain).toEqual(mockFromChain)
      expect(result.toChain).toEqual(mockToChain)
      expect(result.fromTokenList).toEqual([mockFromTokenExact])
      expect(result.toTokenList).toEqual([mockToTokenExact])
      expect(MockedTokenMatcher).toHaveBeenCalledWith(mockFromChain.id)
      expect(MockedTokenMatcher).toHaveBeenCalledWith(mockToChain.id)
    })

    it('should return multiple tokens if fuzzy matches are found and input doesnt exactly match name/symbol', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [mockFromChain]
        if (query === toChainStr) return [mockToChain]
        return []
      })

      mockTokenMatchFn.mockImplementation(function (
        this: { chainId: number },
        query: string
      ) {
        if (this.chainId === mockFromChain.id && query === 'et')
          return mockFromTokenFuzzyList // query 'et' is not 'ETH' or 'Ether'
        if (this.chainId === mockToChain.id && query === 'mat')
          return mockToTokenFuzzyList // query 'mat' is not 'MATIC' or 'Matic Token'
        return []
      })

      const result = await matcherInstance.fuzzyIntentDetect(
        fromChainStr,
        toChainStr,
        'et',
        'mat'
      )
      expect(result.fromTokenList).toEqual(mockFromTokenFuzzyList)
      expect(result.toTokenList).toEqual(mockToTokenFuzzyList)
    })

    it('should return only the exact match from list if input token string matches symbol/name exactly (case-insensitive)', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [mockFromChain]
        if (query === toChainStr) return [mockToChain]
        return []
      })

      // Simulate TokenMatcher returning a list where the first is an exact symbol/name match
      mockTokenMatchFn.mockImplementation(function (
        this: { chainId: number },
        query: string
      ) {
        if (
          this.chainId === mockFromChain.id &&
          query.toLowerCase() === mockFromTokenExact.symbol.toLowerCase()
        ) {
          return mockFromTokenFuzzyList // Full list includes the exact match at index 0
        }
        if (
          this.chainId === mockToChain.id &&
          query.toLowerCase() === mockToTokenExact.name.toLowerCase()
        ) {
          return mockToTokenFuzzyList // Full list
        }
        return []
      })

      // Test with 'ETH' (exact symbol match for fromToken) and 'Matic Token' (exact name match for toToken)
      const result = await matcherInstance.fuzzyIntentDetect(
        fromChainStr,
        toChainStr,
        'ETH',
        'Matic Token'
      )
      expect(result.fromTokenList).toEqual([mockFromTokenExact]) // Should only keep the exact one
      expect(result.toTokenList).toEqual([mockToTokenExact]) // Should only keep the exact one
    })

    it('should throw MissingChainError if fromChain is not found', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [] // No fromChain
        if (query === toChainStr) return [mockToChain]
        return []
      })
      
      // Ensure toToken is found so we can reach the fromChain validation
      mockTokenMatchFn.mockImplementation(function (
        this: { chainId: number },
        query: string
      ) {
        if (this.chainId === mockToChain.id && query === toTokenStr)
          return [mockToTokenExact]
        return []
      })
      
      await expect(
        matcherInstance.fuzzyIntentDetect(
          fromChainStr,
          toChainStr,
          fromTokenStr,
          toTokenStr
        )
      ).rejects.toThrow(MissingChainError)
    })

    it('should throw MissingChainError if toChain is not found', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [mockFromChain]
        if (query === toChainStr) return [] // No toChain
        return []
      })
      await expect(
        matcherInstance.fuzzyIntentDetect(
          fromChainStr,
          toChainStr,
          fromTokenStr,
          toTokenStr
        )
      ).rejects.toThrow(MissingChainError)
    })

    it('should throw MissingTokenError if fromToken is not found', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [mockFromChain]
        if (query === toChainStr) return [mockToChain]
        return []
      })

      mockTokenMatchFn.mockImplementation(function (
        this: { chainId: number },
        query: string
      ) {
        if (this.chainId === mockFromChain.id && query === fromTokenStr)
          return [] // No fromToken
        if (this.chainId === mockToChain.id && query === toTokenStr)
          return [mockToTokenExact]
        return []
      })
      await expect(
        matcherInstance.fuzzyIntentDetect(
          fromChainStr,
          toChainStr,
          fromTokenStr,
          toTokenStr
        )
      ).rejects.toThrow(
        new MissingTokenError(
          `No token matches found for fromToken ${fromTokenStr} on chain ${mockFromChain.name}`
        )
      )
    })

    it('should throw MissingTokenError if toToken is not found', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [mockFromChain]
        if (query === toChainStr) return [mockToChain]
        return []
      })

      mockTokenMatchFn.mockImplementation(function (
        this: { chainId: number },
        query: string
      ) {
        if (this.chainId === mockFromChain.id && query === fromTokenStr)
          return [mockFromTokenExact]
        if (this.chainId === mockToChain.id && query === toTokenStr) return [] // No toToken
        return []
      })
      await expect(
        matcherInstance.fuzzyIntentDetect(
          fromChainStr,
          toChainStr,
          fromTokenStr,
          toTokenStr
        )
      ).rejects.toThrow(
        new MissingTokenError(
          `No token matches found for toToken ${toTokenStr} on chain ${mockToChain.name}`
        )
      )
    })

    it('should cache TokenMatcher instances and reuse them for the same chainId', async () => {
      internalChainMatcherMock.match.mockImplementation((query: string) => {
        if (query === fromChainStr) return [mockFromChain] // id: 1
        if (query === toChainStr) return [mockToChain] // id: 137
        if (query === 'arbitrum')
          return [{ id: 42161, name: 'Arbitrum', coin: 'ETH', score: 0.1 }] // id: 42161
        return []
      })
      mockTokenMatchFn.mockReturnValue([mockFromTokenExact]) // Generic return

      // First call: creates TokenMatchers for chainId 1 and 137
      await matcherInstance.fuzzyIntentDetect(
        fromChainStr,
        toChainStr,
        fromTokenStr,
        toTokenStr
      )
      expect(MockedTokenMatcher).toHaveBeenCalledTimes(2)
      expect(MockedTokenMatcher).toHaveBeenCalledWith(mockFromChain.id) // 1
      expect(MockedTokenMatcher).toHaveBeenCalledWith(mockToChain.id) // 137

      MockedTokenMatcher.mockClear() // Clear call counts for the constructor

      // Second call: fromChain (1) is same, toChain is new (42161)
      await matcherInstance.fuzzyIntentDetect(
        fromChainStr,
        'arbitrum',
        fromTokenStr,
        toTokenStr
      )
      // TokenMatcher for chainId 1 should be reused from cache
      // TokenMatcher for chainId 42161 should be newly created
      expect(MockedTokenMatcher).toHaveBeenCalledTimes(1)
      expect(MockedTokenMatcher).toHaveBeenCalledWith(42161)
      expect(MockedTokenMatcher).not.toHaveBeenCalledWith(mockFromChain.id) // Should not be called again for chain 1

      MockedTokenMatcher.mockClear()

      // Third call: both chains (1 and 137) have been used before
      await matcherInstance.fuzzyIntentDetect(
        fromChainStr,
        toChainStr,
        fromTokenStr,
        toTokenStr
      )
      // No new TokenMatcher instances should be created
      expect(MockedTokenMatcher).toHaveBeenCalledTimes(0)
    })
  })
})

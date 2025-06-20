import { getTokenBalances } from '../alchemy/get-token-balance'
import { Token, TokenMatcher, ScoredToken } from './fuzzy-token-matcher'

export interface TokenMatchResult {
  status: 'success' | 'fail'
  token?: Token
  error_message?: string
}

interface ScoredTokenMatch {
  token: Token
  score: number
  characterOverlapScore: number
  tokenTypePreference: number
  totalScore: number
}

/**
 * Enhanced scoring function that combines Fuse.js scores with character overlap and token type preference
 */
function calculateEnhancedTokenScore(
  token: Token,
  query: string,
  fuseScore: number
): ScoredTokenMatch {
  const symbol = token.symbol.toLowerCase()
  const name = token.name.toLowerCase()
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, '')
  
  let tokenTypePreference = 0
  if (normalizedQuery.includes('pt') && symbol.includes('pt-')) {
    tokenTypePreference = 0.3
  } else if (normalizedQuery.includes('yt') && symbol.includes('yt-')) {
    tokenTypePreference = 0.3
  }
  
  let characterOverlapScore = 0
  const matchesQuery = symbol.includes(normalizedQuery) || 
                      name.includes(normalizedQuery) ||
                      (normalizedQuery.includes('solvbtc') && (symbol.includes('xsolvbtc') || name.includes('xsolvbtc'))) ||
                      (normalizedQuery.includes('sena') && (symbol.includes('sena') || name.includes('sena'))) ||
                      (normalizedQuery.includes('eusde') && (symbol.includes('eusde') || name.includes('eusde'))) ||
                      symbol.replace(/[^a-z0-9]/g, '').includes(normalizedQuery.replace(/[^a-z0-9]/g, '')) ||
                      name.replace(/[^a-z0-9]/g, '').includes(normalizedQuery.replace(/[^a-z0-9]/g, ''))
  
  if (matchesQuery) {
    characterOverlapScore = 0.4
  }
  
  const totalScore = (1 - fuseScore) * 0.3 + characterOverlapScore + tokenTypePreference
  
  return {
    token,
    score: fuseScore,
    characterOverlapScore,
    tokenTypePreference,
    totalScore
  }
}

/**
 * Helper function to process token matches and return appropriate result
 */
function processTokenMatches(
  tokenMatches: ScoredToken[],
  identifier: string
): TokenMatchResult {
  if (tokenMatches.length === 0) {
    return {
      status: 'fail',
      error_message: 'Token not found'
    }
  }

  const exactMatch = tokenMatches.find(token =>
    token.symbol.toLowerCase() === identifier.toLowerCase() ||
    token.address.toLowerCase() === identifier.toLowerCase() ||
    token.name.toLowerCase() === identifier.toLowerCase()
  )
  
  if (exactMatch) {
    return {
      status: 'success',
      token: exactMatch
    }
  }

  if (tokenMatches.length > 1) {
    const scoredMatches = tokenMatches.map(token => 
      calculateEnhancedTokenScore(token, identifier, token.score)
    )
    
    scoredMatches.sort((a, b) => b.totalScore - a.totalScore)
    
    return {
      status: 'success',
      token: scoredMatches[0].token
    }
  }

  return {
    status: 'success',
    token: tokenMatches[0]
  }
}

/**
 * Match a token in user wallet by token name, symbol, or address
 * @param identifier address, symbol, or name of the token
 * @param walletAddress address of the user wallet
 * @param chainId chain id
 * @param isDemo whether to use the demo mode
 * @returns TokenMatchResult
 */
export async function findTokenInUserWalletByIdentifier(
  identifier: string,
  walletAddress: string,
  chainId: number,
  isDemo: boolean,
  alreadyFetchedTokenBalances?: Token[]
): Promise<TokenMatchResult> {
  const tokenBalances = alreadyFetchedTokenBalances || (await getTokenBalances(walletAddress, chainId, isDemo))
  const tokenForMatcher: Token[] = tokenBalances.map(token => ({
    chainId: chainId,
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals
  }))

  const tokenMatcher = new TokenMatcher(chainId, 0.5, tokenForMatcher)
  const tokenMatches = tokenMatcher.match(identifier)

  const result = processTokenMatches(tokenMatches, identifier)
  if (result.status === 'fail' && result.error_message === 'Token not found') {
    result.error_message = 'Token not found in wallet'
  }
  return result
}

export async function findTokenInFullListByIdentifier(
  identifier: string,
  chainId: number
): Promise<TokenMatchResult> {
  const tokenMatcher = new TokenMatcher(chainId, 0.5)
  const tokenMatches = tokenMatcher.match(identifier)

  const result = processTokenMatches(tokenMatches, identifier)
  if (result.status === 'fail' && result.error_message === 'Token not found') {
    result.error_message = 'Token not found in full list'
  }
  return result
}

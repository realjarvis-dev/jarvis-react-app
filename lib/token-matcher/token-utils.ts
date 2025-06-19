import { getTokenBalances } from '../alchemy/get-token-balance'
import { Token, TokenMatcher } from './fuzzy-token-matcher'

export interface TokenMatchResult {
  status: 'success' | 'fail'
  token?: Token
  error_message?: string
}

/**
 * Helper function to process token matches and return appropriate result
 */
function processTokenMatches(
  tokenMatches: Token[],
  identifier: string
): TokenMatchResult {
  if (tokenMatches.length === 0) {
    return {
      status: 'fail',
      error_message: 'Token not found'
    }
  }

  // test for exact match
  const token = tokenMatches[0]
  if (
    tokenMatches.length > 1 &&
    !(
      token.symbol.toLowerCase() === identifier.toLowerCase() ||
      token.address.toLowerCase() === identifier.toLowerCase() ||
      token.name.toLowerCase() === identifier.toLowerCase()
    )
  ) {
    const possibleTokens = tokenMatches.map(token => token.name)
    return {
      status: 'fail',
      error_message: `Found multiple matches, possible matches: ${possibleTokens}`
    }
  }

  return {
    status: 'success',
    token
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

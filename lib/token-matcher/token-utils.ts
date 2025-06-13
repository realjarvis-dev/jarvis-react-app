import { getTokenBalances } from '../alchemy/get-token-balance'
import { Token, TokenMatcher } from './fuzzy-token-matcher'

export interface TokenMatchResult {
  status: 'success' | 'fail'
  token?: Token
  error_message?: string
}

export async function findTokenByIdentifier(
  identifier: string,
  walletAddress: string,
  chainId: number,
  isDemo: boolean
): Promise<TokenMatchResult> {
  const tokenBalances = await getTokenBalances(walletAddress, chainId, isDemo)
  const tokenForMatcher: Token[] = tokenBalances.map(token => ({
    chainId: chainId,
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals
  }))

  const tokenMatcher = new TokenMatcher(chainId, 0.3, tokenForMatcher)
  const tokenMatches = tokenMatcher.match(identifier)

  if (tokenMatches.length === 0) {
    return {
      status: 'fail',
      error_message: 'Token not found in wallet'
    }
  }

  // test for exact match
  const token = tokenMatches[0]
  if (
    tokenMatches.length > 1 &&
    !(
      token.symbol === identifier ||
      token.address === identifier ||
      token.name === identifier
    )
  ) {
    const possibleTokens = tokenMatches.map(token => token.name)
    return {
      status: 'fail',
      error_message: `Found multiple matches in wallet, possible matches: ${possibleTokens}`
    }
  }

  return {
    status: 'success',
    token
  }
}

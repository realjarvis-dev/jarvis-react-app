import { Cacheable } from '@type-cacheable/core'
import { ChainMatcher, type Chain } from './fuzzy-chain-matcher'
import { TokenMatcher, type Token } from './fuzzy-token-matcher'

import { LIFI_SOLANA_CHAIN_ID } from './token-utils'

export class MissingChainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingChainError'
  }
}

export class MissingTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingTokenError'
  }
}

// cache token matcher here
// const tokenMatcherMap = new Map<number, TokenMatcher>() // Will be moved into the class
const solanaCommonTokenList = [
    {"address": '11111111111111111111111111111111',
    "decimals": 9,
    "chainId": LIFI_SOLANA_CHAIN_ID,
    "symbol": "SOL",
    "name": "Solana",
  },
  {
    "address": 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    "decimals": 6,
    "chainId": LIFI_SOLANA_CHAIN_ID,
    "symbol": "USDC",
    "name": "USDC",
  },
  {
    "address": 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    "decimals": 6,
    "chainId": LIFI_SOLANA_CHAIN_ID,
    "symbol": "USDT",
    "name": "USDT",
  },
]
class CrossChainMatcher {
  private static instance: CrossChainMatcher
  private matcher: ChainMatcher
  private tokenMatcherMap: Map<number, TokenMatcher>
  private solanaTokenMatcher: TokenMatcher

  private constructor() {
    this.matcher = new ChainMatcher()
    this.tokenMatcherMap = new Map<number, TokenMatcher>()
    this.solanaTokenMatcher = new TokenMatcher(LIFI_SOLANA_CHAIN_ID, 0.3, solanaCommonTokenList)
  }

  public static getInstance(): CrossChainMatcher {
    if (!CrossChainMatcher.instance) {
      CrossChainMatcher.instance = new CrossChainMatcher()
    }
    return CrossChainMatcher.instance
  }

  private getSolanaToken(token: string): Token[] {
    const solanaCommonTokenMap = {
      "SOL": {
        "address": '11111111111111111111111111111111',
        "decimals": 9,
        "chainId": LIFI_SOLANA_CHAIN_ID,
        "symbol": "SOL",
        "name": "Solana",
      },
      "USDC": {
        "address": 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        "decimals": 6,
        "chainId": LIFI_SOLANA_CHAIN_ID,
        "symbol": "USDC",
        "name": "USDC",
      },
      "USDT": {
        "address": 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        "decimals": 6,
        "chainId": LIFI_SOLANA_CHAIN_ID,
        "symbol": "USDT",
        "name": "USDT",
      },
    }
    const solanaTokenMatch = this.solanaTokenMatcher.match(token)
    if (solanaTokenMatch.length > 0) {
      return solanaTokenMatch
    }
    throw new MissingTokenError(`Oops, we only support bridging to/from SOL and USDC on Solana.`)
  }

  private validateChainMatches(chainMatches: Chain[], chainString: string, chainType: 'from' | 'to'): Chain {
    if (chainMatches.length === 0) {
      throw new MissingChainError(
        `No chain matches found for ${chainType}ChainString ${chainString}`
      )
    }
    return chainMatches[0]
  }

  private validateTokenMatches(tokenMatches: Token[], token: string, chainName: string, tokenType: 'from' | 'to'): Token[] {
    if (tokenMatches.length === 0) {
      throw new MissingTokenError(
        `No token matches found for ${tokenType}Token ${token} on chain ${chainName}`
      )
    }

    const topMatch = tokenMatches[0]
    
    // if top one is an exact match, only keep the top one
    if (
      topMatch.symbol.toLowerCase() === token.toLowerCase() ||
      topMatch.name.toLowerCase() === token.toLowerCase()
    ) {
      return [topMatch]
    } else {
      return tokenMatches
    }
  }

  @Cacheable({
    ttlSeconds: 60 * 60 * 24, // 1 day
  })
  public async fuzzyIntentDetect(
    fromChainString: string,
    toChainString: string,
    fromToken: string,
    toToken: string
  ): Promise<{
    fromChain: Chain
    toChain: Chain
    fromTokenList: Token[]
    toTokenList: Token[]
  }> { 

    // match the chains and tokens
    let toChain: Chain
    let toTokenList: Token[]
    let fromChain: Chain
    let fromTokenList: Token[]
    if (toChainString.toLowerCase() === "solana") {
      toChain = {
        "name": "SOL",
        "coin": "SOL",
        "id": LIFI_SOLANA_CHAIN_ID,
      } as Chain
      toTokenList = this.getSolanaToken(toToken)
    } else {
      const toChainMatches: Chain[] = this.matcher.match(toChainString)
      toChain = this.validateChainMatches(toChainMatches, toChainString, 'to')
      const toChainId = toChain.id
      const toTokenMatcher = this.getTokenMatcher(toChainId)
      const toTokenMatches = toTokenMatcher.match(toToken)
      toTokenList = this.validateTokenMatches(toTokenMatches, toToken, toChain.name, 'to')
    }
    if (fromChainString.toLowerCase() === "solana") {
      fromChain = {
        "name": "SOL",
        "coin": "SOL",
        "id": LIFI_SOLANA_CHAIN_ID,
      } as Chain
      fromTokenList = this.getSolanaToken(fromToken)
    } else {
      const fromChainMatches: Chain[] = this.matcher.match(fromChainString)
      fromChain = this.validateChainMatches(fromChainMatches, fromChainString, 'from')
      const fromChainId = fromChain.id
      const fromTokenMatcher = this.getTokenMatcher(fromChainId)
      const fromTokenMatches = fromTokenMatcher.match(fromToken)
      fromTokenList = this.validateTokenMatches(fromTokenMatches, fromToken, fromChain.name, 'from')
    }

    

    return {
      fromChain,
      toChain,
      fromTokenList,
      toTokenList
    }
  }

  private getTokenMatcher(chainId: number) {
    let tokenMatcher = this.tokenMatcherMap.get(chainId)
    if (!tokenMatcher) {
      tokenMatcher = new TokenMatcher(chainId)
      this.tokenMatcherMap.set(chainId, tokenMatcher)
    }
    return tokenMatcher
  }
}

// Export the singleton instance
export const crossChainMatcher = CrossChainMatcher.getInstance()

// console.log(await fuzzyIntentDetect('ethereum', 'berachain', 'usd', 'wbera'))

// try {
//   const quote = await lifiService.crossChainSwapQuote(
//     // Use the service instance
//     80094,
//     1,
//     'bera',
//     'eth',
//     '1000000000000000',
//     '0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8',
//     '0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8',
//     '0.005'
//   )
// } catch (error) {
//   console.log(error)
// }


// const readableQuote = {

//   fromAmountUSD: quote.estimate?.fromAmountUSD,
//   toAmountUSD: quote.estimate?.toAmountUSD,
//   gasCostsUSD: quote.estimate?.gasCosts?.reduce((acc, curr) => acc + Number(curr.amountUSD), 0),
//   otherFeeName: quote.estimate?.feeCosts?.map((fee) => fee.name).join(', '),
//   otherFeeAmountUSD: quote.estimate?.feeCosts?.reduce((acc, curr) => acc + Number(curr.amountUSD), 0)
// }
// console.log(readableQuote)

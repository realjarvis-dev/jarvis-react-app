// import { Cacheable } from '@type-cacheable/core'
import { LifiQuoteResponse } from '../types/lifi'
import { ChainMatcher, ChainWithScore } from './fuzzy-chain-matcher'
import { TokenMatcher, TokenWithScore } from './fuzzy-token-matcher'

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

class LifiService {
  private static instance: LifiService
  private matcher: ChainMatcher
  private tokenMatcherMap: Map<number, TokenMatcher>

  private constructor() {
    this.matcher = new ChainMatcher()
    this.tokenMatcherMap = new Map<number, TokenMatcher>()
  }

  public static getInstance(): LifiService {
    if (!LifiService.instance) {
      LifiService.instance = new LifiService()
    }
    return LifiService.instance
  }



  public async fuzzyIntentDetect(
    fromChainString: string,
    toChainString: string,
    fromToken: string,
    toToken: string
  ): Promise<{
    fromChain: ChainWithScore
    toChain: ChainWithScore
    fromTokenList: TokenWithScore[]
    toTokenList: TokenWithScore[]
  }> {
    // match the chains and tokens
    const fromChainMatches: ChainWithScore[] =
      this.matcher.match(fromChainString)
    const toChainMatches: ChainWithScore[] = this.matcher.match(toChainString)

    if (fromChainMatches.length === 0) {
      throw new MissingChainError(
        `No chain matches found for fromChainString ${fromChainString}`
      )
    }

    if (toChainMatches.length === 0) {
      throw new MissingChainError(
        `No chain matches found for toChainString ${toChainString}`
      )
    }

    // take the top 1 chain id
    const fromChain = fromChainMatches[0]
    const toChain = toChainMatches[0]
    const fromChainId = fromChain.id
    const toChainId = toChain.id

    const fromTokenMatcher = this.getTokenMatcher(fromChainId)
    const toTokenMatcher = this.getTokenMatcher(toChainId)

    const fromTokenMatches = fromTokenMatcher.match(fromToken)
    const toTokenMatches = toTokenMatcher.match(toToken)

    if (fromTokenMatches.length === 0) {
      throw new MissingTokenError(
        `No token matches found for fromToken ${fromToken} on chain ${fromChain.name}`
      )
    }

    if (toTokenMatches.length === 0) {
      throw new MissingTokenError(
        `No token matches found for toToken ${toToken} on chain ${toChain.name}`
      )
    }

    // if top one is an exact match, only keep the top one
    const fromTokenMatch = fromTokenMatches[0]
    const toTokenMatch = toTokenMatches[0]

    let resultFromToken
    let resultToToken

    if (
      fromTokenMatch.symbol.toLowerCase() === fromToken.toLowerCase() ||
      fromTokenMatch.name.toLowerCase() === fromToken.toLowerCase()
    ) {
      resultFromToken = [fromTokenMatch]
    } else {
      resultFromToken = fromTokenMatches
    }

    if (
      toTokenMatch.symbol.toLowerCase() === toToken.toLowerCase() ||
      toTokenMatch.name.toLowerCase() === toToken.toLowerCase()
    ) {
      resultToToken = [toTokenMatch]
    } else {
      resultToToken = toTokenMatches
    }

    return {
      fromChain,
      toChain,
      fromTokenList: resultFromToken,
      toTokenList: resultToToken
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
export const lifiService = LifiService.getInstance()

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

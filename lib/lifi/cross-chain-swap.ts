import { Cacheable } from '@type-cacheable/core'
import { LifiQuoteResponse } from '../types/lifi'
import { ChainMatcher, ChainWithScore } from './fuzzy-chain-matcher'
import { TokenMatcher, TokenWithScore } from './fuzzy-token-matcher'

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

  /**
   * Get a quote for a cross-chain swap.
   * @param fromChainId - The ID of the chain to swap from.
   * @param toChainId - The ID of the chain to swap to.
   * @param fromToken - The symbol of the token to swap from.
   * @param toToken - The symbol of the token to swap to.
   * @param fromAmount - The amount of the token to swap from.
   * @param fromAddress - The address of the user's wallet.
   * @param toAddress - The address of the user's wallet.
   * @param slippage - The slippage tolerance for the transaction, 0.005 represents 0.5% slippage.
   * @returns A quote for the cross-chain swap.
   */
  @Cacheable({ ttlSeconds: 300 })
  public async crossChainSwapQuote(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    fromAddress: string,
    toAddress: string,
    slippage: string
  ): Promise<LifiQuoteResponse> {
    const baseUrl = 'https://li.quest/v1/quote'
    const params = new URLSearchParams({
      fromChain: fromChainId.toString(),
      toChain: toChainId.toString(),
      fromToken: fromToken,
      toToken: toToken,
      fromAmount: fromAmount,
      fromAddress: fromAddress,
      toAddress: toAddress,
      slippage: slippage
    })

    const response = await fetch(`${baseUrl}?${params.toString()}`)

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `LI.FI API request failed with status ${response.status}: ${errorBody}`
      )
    }

    const result: LifiQuoteResponse = await response.json()
    return result
  }

  public async fuzzyIntentDetect(
    fromChainString: string,
    toChainString: string,
    fromToken: string,
    toToken: string
  ): Promise<{ fromChain: ChainWithScore; toChain: ChainWithScore; fromTokenList: TokenWithScore[]; toTokenList: TokenWithScore[] }> {
    // match the chains and tokens
    const fromChainMatches: ChainWithScore[] =
      this.matcher.match(fromChainString)
    const toChainMatches: ChainWithScore[] = this.matcher.match(toChainString)

    if (fromChainMatches.length === 0) {
      throw new Error(
        `No chain matches found for fromChainString ${fromChainString}`
      )
    }

    if (toChainMatches.length === 0) {
      throw new Error(
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
      throw new Error(
        `No token matches found for fromToken ${fromToken} on chain ${fromChainId}`
      )
    }

    if (toTokenMatches.length === 0) {
      throw new Error(
        `No token matches found for toToken ${toToken} on chain ${toChainId}`
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

const quote = await lifiService.crossChainSwapQuote(
    // Use the service instance
    1,
    80094,
    'usdc',
    'wbera',
    '1000000',
    '0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8',
    '0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8',
    '0.005'
  )


// const readableQuote = {

//   fromAmountUSD: quote.estimate?.fromAmountUSD,
//   toAmountUSD: quote.estimate?.toAmountUSD,
//   gasCostsUSD: quote.estimate?.gasCosts?.reduce((acc, curr) => acc + Number(curr.amountUSD), 0),
//   otherFeeName: quote.estimate?.feeCosts?.map((fee) => fee.name).join(', '),
//   otherFeeAmountUSD: quote.estimate?.feeCosts?.reduce((acc, curr) => acc + Number(curr.amountUSD), 0)
// }
// console.log(readableQuote)

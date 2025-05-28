import { ChainMatcher, ChainWithScore } from "./fuzzy-chain-matcher";
import { TokenMatcher } from "./fuzzy-token-matcher";
const matcher = new ChainMatcher();

// cache token matcher here
const tokenMatcherMap = new Map<number, TokenMatcher>();

export const crossChainSwapQuote = async (
  fromChainId: number,
  toChainId: number,
  fromToken: string,
  toToken: string,
) => {
    // implement strict swap quote by calling lifi api

}


export const fuzzyIntentDetect = async (
  fromChainString: string,
  toChainString: string,
  fromToken: string,
  toToken: string,
) => {
    // match the chains and tokens
    const fromChainMatches: ChainWithScore[] = matcher.match(fromChainString)
    const toChainMatches: ChainWithScore[] = matcher.match(toChainString)

    if (fromChainMatches.length === 0) {
        throw new Error(`No chain matches found for fromChainString ${fromChainString}`)
    }

    if (toChainMatches.length === 0) {
        throw new Error(`No chain matches found for toChainString ${toChainString}`)
    }

    // take the top 1 chain id
    const fromChainId = fromChainMatches[0].id
    const toChainId = toChainMatches[0].id
    
    const fromTokenMatcher = getTokenMatcher(fromChainId)
    const toTokenMatcher = getTokenMatcher(toChainId)

    const fromTokenMatches = fromTokenMatcher.match(fromToken)
    const toTokenMatches = toTokenMatcher.match(toToken)

    if (fromTokenMatches.length === 0) {
        throw new Error(`No token matches found for fromToken ${fromToken} on chain ${fromChainId}`)
    }

    if (toTokenMatches.length === 0) {
        throw new Error(`No token matches found for toToken ${toToken} on chain ${toChainId}`)
    }

    // if top one is an exact match, only keep the top one
    const fromTokenMatch = fromTokenMatches[0]
    const toTokenMatch = toTokenMatches[0]

    let resultFromToken;
    let resultToToken;

    if (fromTokenMatch.symbol.toLowerCase() === fromToken.toLowerCase() || fromTokenMatch.name.toLowerCase() === fromToken.toLowerCase()) {
        resultFromToken = [fromTokenMatch]
    } else {
        resultFromToken = fromTokenMatches
    }

    if (toTokenMatch.symbol.toLowerCase() === toToken.toLowerCase() || toTokenMatch.name.toLowerCase() === toToken.toLowerCase()) {
        resultToToken = [toTokenMatch]
    } else {
        resultToToken = toTokenMatches
    }

    return {
        fromChainId,
        toChainId,
        fromToken: resultFromToken,
        toToken: resultToToken
    }
}

const getTokenMatcher = (chainId: number) => {
    let tokenMatcher = tokenMatcherMap.get(chainId)
    if (!tokenMatcher) {
        tokenMatcher = new TokenMatcher(chainId)
        tokenMatcherMap.set(chainId, tokenMatcher)
    }
    return tokenMatcher
}

console.log(await fuzzyIntentDetect("ethereum", "berachain", "usd", "wbera"))
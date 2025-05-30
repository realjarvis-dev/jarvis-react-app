import { ChainWithScore } from '../token-matcher/fuzzy-chain-matcher'
import { TokenWithScore } from '../token-matcher/fuzzy-token-matcher'

export const noRouteDetails = 'Reasons for that could be: low liquidity, amount selected is too low, gas costs are too high or there are no routes for the selected combination.'
export const noRouteTitle = 'No routes available for the selected combination'

export const autoFuelFailDetails = 'Reasons for that could be: low liquidity, amount selected is too low, gas costs are too high or there are no routes for the selected combination.'
export const autoFuelFailTitle = 'Failed to auto-fuel destination chain with input token'


export const getClarifyInputAndOutputDetail = (
  fromChain: ChainWithScore,
  toChain: ChainWithScore,
  fromTokenList: TokenWithScore[],
  toTokenList: TokenWithScore[]
) => {
  const possibleInputTokens = fromTokenList
    .map(token => token.symbol)
    .join(', ')
  const possibleOutputTokens = toTokenList.map(token => token.symbol).join(', ')
  return `Multiple tokens found, please choose the token you want to bridge from and to. Possible input tokens on ${fromChain.name} chain: ${possibleInputTokens}, possible output tokens on ${toChain.name} chain: ${possibleOutputTokens}`
}

export const getClarifyInputDetail = (
  fromChain: ChainWithScore,
  fromTokenList: TokenWithScore[]
) => {
  const possibleInputTokens = fromTokenList
    .map(token => token.symbol)
    .join(', ')
  return `Multiple input tokens found, please choose the token you want to bridge from. Possible input tokens on ${fromChain.name} chain: ${possibleInputTokens}`
}

export const getClarifyOutputDetail = (
  toChain: ChainWithScore,
  toTokenList: TokenWithScore[]
) => {
  const possibleOutputTokens = toTokenList.map(token => token.symbol).join(', ')
  return `Multiple output tokens found, please choose the token you want to bridge to. Possible output tokens on ${toChain.name} chain: ${possibleOutputTokens}`
}

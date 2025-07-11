import { getTokenBalances } from '@/lib/alchemy/get-token-balance'
import { getTokenUsdPriceBatch } from '@/lib/enso/get-token-usd-price'
import { getJupiterTokenPrices } from '@/lib/jupiter/price'
import { TokenPrice } from '@/lib/types/token-price'
import { getTokenBalances as getTokenBalancesSolana } from '../helius/get-token-balance'
import { SOLANA_CHAIN_ID } from '../network/config'
import { TokenData } from '../types/wallet-token'
import { getTokenUsdPrice } from './get-token-usd-price'
export async function computeUserUsdBalance(
  walletAddress: string,
  chainId: number,
  isDemo: boolean
) {
  let tokenBalances: TokenData[] = []
  let tokenPrices: TokenPrice[] = []

  if (chainId === SOLANA_CHAIN_ID) {
    tokenBalances = await getTokenBalancesSolana(walletAddress)
    if (tokenBalances.length === 0) {
      return 0
    }
    const tokenAddresses = tokenBalances.map(token => token.address)
    tokenPrices = await getJupiterTokenPrices(tokenAddresses)
  } else {
    tokenBalances = await getTokenBalances(walletAddress, chainId, isDemo)
    if (tokenBalances.length === 0) {
      return 0
    }
    const tokenAddresses = tokenBalances.map(token => token.address)
    tokenPrices = await getTokenUsdPrice(tokenAddresses, chainId)
  }

  const tokenUsdPrices = tokenPrices.reduce((acc, singleTokenPrice) => {
    // filter out null values since there are scam tokens without prices
    if (singleTokenPrice) {
      acc[singleTokenPrice.address.toLowerCase()] = singleTokenPrice.price
    }
    return acc
  }, {} as Record<string, number>)
  const usdBalance = tokenBalances.reduce((acc, token) => {
    const price = tokenUsdPrices[token.address.toLowerCase()]
    return acc + (price ? Number(token.balance) * price : 0)
  }, 0)
  return usdBalance
}


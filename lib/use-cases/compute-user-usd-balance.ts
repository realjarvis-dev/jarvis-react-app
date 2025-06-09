import { getTokenBalances } from "@/lib/alchemy/get-token-balance"
import { getTokenUsdPriceBatch } from "@/lib/enso/get-token-usd-price"

export async function computeUserUsdBalance(walletAddress: string, chainId: number, isDemo: boolean) {
    const tokenBalances = await getTokenBalances(walletAddress, chainId, isDemo)
    const tokenAddresses = tokenBalances.map(token => token.address)
    const tokenPrices = await getTokenUsdPriceBatch(tokenAddresses, chainId)
    const tokenUsdPrices = tokenPrices.reduce((acc, price) => {
        acc[price.address.toLowerCase()] = price.price
        return acc
    }, {} as Record<string, number>)
    const usdBalance = tokenBalances.reduce((acc, token) => {
        const price = tokenUsdPrices[token.address.toLowerCase()]
        return acc + (price ? Number(token.balance) * price : 0)
    }, 0)
    return usdBalance
}

// console.log(await computeUserUsdBalance('0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8', 1, false))
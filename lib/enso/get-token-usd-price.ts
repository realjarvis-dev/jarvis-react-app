import axios from 'axios'

export type EnsoTokenPriceType = {
    decimals: number
    symbol: string
    price: number
    timestamp: number
    confidence: number
    address: string
    chainId: number
}

export type EnsoResponseType = {
    data: EnsoTokenPriceType[]
}

export async function getTokenUsdPriceBatch(tokenAddresses: string[], chainId: number): Promise<EnsoTokenPriceType[]> {
    const response: EnsoResponseType = await axios.get(`https://api.enso.finance/api/v1/prices/${chainId}`, {
        params: {
            addresses: tokenAddresses
        },
        headers: {
            'Authorization': `Bearer ${process.env.ENSO_API_KEY}`
        }
    })
    return response.data
}

// console.log(await getTokenUsdPriceBatch(['0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', '0x6b175474e89094c44da98b954eedeac495271d0f'], 1))
import { TokenPrice } from "../types/token-price";


export async function getTokenUsdPriceBatch(addresses: string[], alchemyNetwork: string): Promise<TokenPrice[]> {
    const url = `https://api.g.alchemy.com/prices/v1/${process.env.ALCHEMY_API_KEY}/tokens/by-address`;


    async function fetchSinglePriceAlchemy(address: string) {
        const options = {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({addresses: [{network: alchemyNetwork, address}]})
        };

        return await fetch(url, options)
    }

    const responses = await Promise.all(addresses.map(address => fetchSinglePriceAlchemy(address)))
    const data = await Promise.all(responses.map(response => response.json()))
    const result = await Promise.all(data.map(async (item) => {
        const price = Number(item.data[0].prices[0].value)
        return {
            address: item.data[0].address,
            price: price
        }
    }))
    return result;
}


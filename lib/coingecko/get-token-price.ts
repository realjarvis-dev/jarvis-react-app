import { TokenPrice } from "../types/token-price";

export async function getTokenUsdPriceBatch(addresses: string[], coingeckoNetworkId: string): Promise<TokenPrice[]> {
    async function fetchSinglePriceCoingecko(address: string) {
        const url = `https://api.coingecko.com/api/v3/onchain/networks/${coingeckoNetworkId}/tokens/${address}`;
        const options = {
        method: 'GET',
        headers: {accept: 'application/json', 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY!}
        };

        return await fetch(url, options)
    }

    const responses = await Promise.all(addresses.map(address => fetchSinglePriceCoingecko(address)))
    const data = await Promise.all(responses.map(response => response.json()))
    const result = data.map((item) => {
        const price = Number(item.data.attributes.price_usd)
        return {
            address: item.data.attributes.address,
            price: price
        }
    })
    return result;
}
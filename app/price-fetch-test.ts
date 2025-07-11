import { getTokenUsdPriceBatch } from "@/lib/enso/get-token-usd-price";

const commonlyUsedTokens = {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
    UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    AAVE: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    MKR: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
    COMP: '0xc00e94cb662c3520282e6f5717214004a7f26888'
}

export const commonlyUsedTokensArray = Object.values(commonlyUsedTokens)

async function fetchBatchPriceAlchemy(addresses: string[]) {
    const url = `https://api.g.alchemy.com/prices/v1/${process.env.ALCHEMY_API_KEY}/tokens/by-address`;


    async function fetchSinglePriceAlchemy(address: string) {
        const options = {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({addresses: [{network: 'eth-mainnet', address}]})
        };

        return await fetch(url, options)
    }

    const responses = await Promise.all(addresses.map(address => fetchSinglePriceAlchemy(address)))
    const data = await Promise.all(responses.map(response => response.json()))
    return data;
}

async function fetchBatchPriceCoingecko(addresses: string[]) {
    async function fetchSinglePriceCoingecko(address: string) {
        const url = `https://api.coingecko.com/api/v3/onchain/networks/eth/tokens/${address}`;
        const options = {
        method: 'GET',
        headers: {accept: 'application/json', 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY!}
        };

        return await fetch(url, options)
    }

    const responses = await Promise.all(addresses.map(address => fetchSinglePriceCoingecko(address)))
    const data = await Promise.all(responses.map(response => response.json()))
    return data;
}

// Timing function
async function timeFunction<T>(fn: () => Promise<T>, name: string): Promise<{ result: T, time: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const time = end - start;
    console.log(`${name}: ${time.toFixed(2)}ms`);
    return { result, time };
}

// Run timing tests
async function runTimingTests() {
    const rounds = 5;
    const alchemyTimes: number[] = [];
    const ensoTimes: number[] = [];
    const coingeckoTimes: number[] = [];

    console.log(`Running ${rounds} rounds of timing tests...\n`);

    for (let i = 1; i <= rounds; i++) {
        console.log(`Round ${i}:`);
        
        // Time Alchemy
        const alchemyResult = await timeFunction(
            () => fetchBatchPriceAlchemy(commonlyUsedTokensArray),
            'Alchemy'
        );
        alchemyTimes.push(alchemyResult.time);

        // Time Enso
        const ensoResult = await timeFunction(
            () => getTokenUsdPriceBatch(commonlyUsedTokensArray, 1),
            'Enso'
        );
        ensoTimes.push(ensoResult.time);

        // Time CoinGecko
        const coingeckoResult = await timeFunction(
            () => fetchBatchPriceCoingecko(commonlyUsedTokensArray),
            'CoinGecko'
        );
        coingeckoTimes.push(coingeckoResult.time);

        console.log(''); // Empty line between rounds
    }

    // Calculate averages
    const alchemyAvg = alchemyTimes.reduce((a, b) => a + b, 0) / alchemyTimes.length;
    const ensoAvg = ensoTimes.reduce((a, b) => a + b, 0) / ensoTimes.length;
    const coingeckoAvg = coingeckoTimes.reduce((a, b) => a + b, 0) / coingeckoTimes.length;

    console.log('=== AVERAGE TIMES ===');
    console.log(`Alchemy: ${alchemyAvg.toFixed(2)}ms`);
    console.log(`Enso: ${ensoAvg.toFixed(2)}ms`);
    console.log(`CoinGecko: ${coingeckoAvg.toFixed(2)}ms`);
    console.log('\n=== DETAILED TIMES ===');
    console.log(`Alchemy times: [${alchemyTimes.map(t => t.toFixed(2)).join(', ')}]`);
    console.log(`Enso times: [${ensoTimes.map(t => t.toFixed(2)).join(', ')}]`);
    console.log(`CoinGecko times: [${coingeckoTimes.map(t => t.toFixed(2)).join(', ')}]`);
}

// Run the timing tests
runTimingTests().catch(console.error);
import { getTokenUsdPriceBatch as getTokenUsdPriceBatchAlchemy } from "@/lib/alchemy/get-token-price";
import { getTokenUsdPriceBatch as getTokenUsdPriceBatchCoingecko } from "@/lib/coingecko/get-token-price";
import { getConfigByChainId } from "@/lib/network/config";

export async function getTokenUsdPrice(addresses: string[], chainId: number) {
    const chainConfig = getConfigByChainId(chainId, false)

    // for sonic, unichain, berachain, we used coingecko
    if (chainId === 146 || chainId === 80094 || chainId === 130) {
        return await getTokenUsdPriceBatchCoingecko(addresses, chainConfig.coingeckoNetworkId)
    } else {
        return await getTokenUsdPriceBatchAlchemy(addresses, chainConfig.alchemyNetwork)
    }
}
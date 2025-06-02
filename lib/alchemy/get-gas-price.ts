import { chainIdToAlchemyClient } from "./client"

/**
 * Get the gas price for a given chain id, in wei
 * @param chainId - The chain id to get the gas price for
 * @returns The gas price in wei
 */
export const getGasPriceByChainId = async (chainId: number): Promise<bigint> => {
  const alchemy = chainIdToAlchemyClient[chainId]
  const gasPrice = await alchemy.core.getGasPrice()
  return gasPrice.toBigInt()
}

console.log(await getGasPriceByChainId(8453))
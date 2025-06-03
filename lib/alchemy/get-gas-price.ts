import { chainIdToAlchemyClient } from "./client"
import { TenderlyDemoConfig } from "../config/network"
/**
 * Get the gas price for a given chain id, in wei
 * The gas price estimate returned by alchemy is always lower than actual gas price
 * Can be use as a lower bound for gas price
 * @param chainId - The chain id to get the gas price for
 * @returns The gas price in wei
 */
export const getGasPriceByChainId = async (chainId: number): Promise<bigint> => {
  if (chainId === TenderlyDemoConfig.chainId) {
    chainId = 1
  }
  const alchemy = chainIdToAlchemyClient[chainId]
  const gasPrice = await alchemy.core.getGasPrice()
  return gasPrice.toBigInt()
}

console.log(await getGasPriceByChainId(8453))
import { chainIdToAlchemyClient } from "./client"


export const getGasPriceByChainId = async (chainId: number): Promise<BigInt> => {
  const alchemy = chainIdToAlchemyClient[chainId]
  const gasPrice = await alchemy.core.getGasPrice()
  return gasPrice.toBigInt()
}

console.log(await getGasPriceByChainId(80094))
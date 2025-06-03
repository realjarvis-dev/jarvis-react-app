import axios from 'axios'
import { hexToBigInt } from 'viem'
export const etherScanApiUrl = "https://api.etherscan.io/v2/api"

export async function getProposedGasPrice(): Promise<number> {
  const response = await axios.get(etherScanApiUrl + "?chainid=1&module=gastracker&action=gasoracle&apikey=" + process.env.ETHERSCAN_API_KEY)
  return response.data.result.ProposeGasPrice
}

export const beraScanApiUrl = "https://api.berascan.com/api"
export async function getBeraProposedGasPrice(): Promise<BigInt> {
  const response = await axios.get(beraScanApiUrl + "?module=proxy&action=eth_gasPrice&apikey=" + process.env.BERASCAN_API_KEY)
  return hexToBigInt(response.data.result)
}

// console.log(await getBeraProposedGasPrice())

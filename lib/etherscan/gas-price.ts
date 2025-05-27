import axios from 'axios'
export const etherScanApiUrl = "https://api.etherscan.io/v2/api"
export async function getProposedGasPrice(): Promise<number> {
  const response = await axios.get(etherScanApiUrl + "?chainid=1&module=gastracker&action=gasoracle&apikey=" + process.env.ETHERSCAN_API_KEY)
  return response.data.result.ProposeGasPrice
}

console.log(await getProposedGasPrice())

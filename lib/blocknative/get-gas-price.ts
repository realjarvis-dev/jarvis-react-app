import { parseEther, parseGwei, parseUnits } from 'viem'
import { TenderlyDemoConfig } from '../config/network'
// {
//     "system": "base",
//     "network": "mainnet",
//     "unit": "gwei",
//     "maxPrice": 0.2,
//     "currentBlockNumber": 31072239,
//     "msSinceLastBlock": 2340,
//     "blockPrices": [
//         {
//             "blockNumber": 31072240,
//             "estimatedTransactionCount": 274,
//             "baseFeePerGas": 0.001016638,
//             "estimatedPrices": [
//                 {
//                     "confidence": 99,
//                     "price": 0.0011,
//                     "maxPriorityFeePerGas": 0.0001,
//                     "maxFeePerGas": 0.0011
//                 },
//                 {
//                     "confidence": 95,
//                     "price": 0.0011,
//                     "maxPriorityFeePerGas": 0.0001,
//                     "maxFeePerGas": 0.0011
//                 },
//                 {
//                     "confidence": 90,
//                     "price": 0.0011,
//                     "maxPriorityFeePerGas": 0.0001,
//                     "maxFeePerGas": 0.0011
//                 },
//                 {
//                     "confidence": 80,
//                     "price": 0.0011,
//                     "maxPriorityFeePerGas": 0.0001,
//                     "maxFeePerGas": 0.0011
//                 },
//                 {
//                     "confidence": 70,
//                     "price": 0.0011,
//                     "maxPriorityFeePerGas": 0.0001,
//                     "maxFeePerGas": 0.0011
//                 }
//             ]
//         }
//     ]
// }
export const getGasPriceByChainId = async (chainId: number) => {
if (chainId === TenderlyDemoConfig.chainId) {
    chainId = 1
  }
  const url = new URL('https://api.blocknative.com/gasprices/blockprices')
  url.searchParams.append('chainid', chainId.toString())
  console.log(url.toString())
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const data = await response.json()
    const unit = data.unit
    let parseFunc
    if (unit === 'gwei') {
      parseFunc = parseGwei
    } else if (unit === 'wei') {
      parseFunc = (value: string) => parseUnits(value, 0)
    } else if (unit === 'ether') {
      parseFunc = parseEther
    } else {
      throw new Error('Invalid unit')
    }
    console.log(JSON.stringify(data, null, 2))
    const maxPriceInMemPool = parseFunc(data.maxPrice.toString())
    const maxPriorityFeePerGas = parseFunc(
      data.blockPrices[0].estimatedPrices[0].maxPriorityFeePerGas.toString()
    )
    const maxFeePerGas = parseFunc(
      data.blockPrices[0].estimatedPrices[0].maxFeePerGas.toString()
    )

    return {
      maxPriceInMemPool,
      maxPriorityFeePerGas,
      maxFeePerGas
    }
  } catch (error) {
    console.error('Error fetching gas price from Blocknative:', error)
    throw error
  }
}

// console.log(await getGasPriceByChainId(8453))

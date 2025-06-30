import { parseEther, parseGwei, parseUnits } from 'viem'
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
  const url = new URL('https://api.blocknative.com/gasprices/blockprices')
  url.searchParams.append('chainid', chainId.toString())
  console.log(url.toString())
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.BLOCKNATIVE_API_KEY
          ? `Bearer ${process.env.BLOCKNATIVE_API_KEY}`
          : ''
      }
    })
    const data = await response.json()

    const unit = data.unit
    let parseFunc
    let precision: number
    if (unit === 'gwei') {
      parseFunc = parseGwei
      precision = 9
    } else if (unit === 'wei') {
      parseFunc = (value: string) => parseUnits(value, 0)
      precision = 0
    } else if (unit === 'ether') {
      parseFunc = parseEther
      precision = 18
    } else {
      throw new Error('Invalid unit')
    }
    const baseFeePerGas = parseFunc(
      Number(data.blockPrices[0].baseFeePerGas).toFixed(precision)
    )
    const maxPriceInMemPool = parseFunc(
      Number(data.maxPrice).toFixed(precision)
    )
    const maxPriorityFeePerGas = parseFunc(
      Number(
        data.blockPrices[0].estimatedPrices[0].maxPriorityFeePerGas
      ).toFixed(precision)
    )
    const maxFeePerGas = parseFunc(
      Number(data.blockPrices[0].estimatedPrices[0].maxFeePerGas).toFixed(
        precision
      )
    )

    return {
      baseFeePerGas,
      maxPriceInMemPool,
      maxPriorityFeePerGas,
      maxFeePerGas
    }
  } catch (error) {
    console.error('Error fetching gas price from Blocknative:', error)
    throw error
  }
}

import axios from 'axios'
import { EnsoSwapInput, EnsoTxInput, EnsoSwapETHToPTInput } from '../types/swap'

export async function ensoSwap(input: EnsoSwapInput) {
  const { chainId, tokenIn, tokenOut, fromAddress, amountIn, slippage } = input

  // enso use 100 for 1%, original slippage was 0.01 for 1%
  const convertedSlippage = slippage * 10000

  const txData = await axios.post(
    'https://api.enso.finance/api/v1/shortcuts/route',
    {
      chainId: chainId,
      fromAddress,
      routingStrategy: 'router',
      receiver: fromAddress,
      spender: fromAddress,
      tokenIn: [tokenIn],
      amountIn: [amountIn],
      tokenOut: [tokenOut],
      slippage: convertedSlippage.toString()
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ENSO_API_KEY}`
      }
    }
  )

  return txData.data.tx as EnsoTxInput
}

export async function ensoSwapEthToToken(input: EnsoSwapETHToPTInput) {
  const { tokenOut, fromAddress, amountIn, slippage } = input

  return await ensoSwap({
    chainId: 1,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut,
    fromAddress,
    amountIn,
    slippage
  })
}

// Test function to run locally
async function testEnsoSwap() {
  try {
    const testInput: EnsoSwapInput = {
      chainId: 1, // Ethereum mainnet
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xf99985822fb361117fcf3768d34a6353e6022f5f', 
      fromAddress: '0xFb697a5eD9cdbbA684511774416cf4424052dC45',
      amountIn: '1000000000000000000', // 1 ETH in wei
      slippage: 0.01 // 1% slippage
    }

    const result = await ensoSwap(testInput)
    console.log('Swap result:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Error testing ensoSwap:', error)
  }
}

// Uncomment the line below to run the test
// testEnsoSwap()

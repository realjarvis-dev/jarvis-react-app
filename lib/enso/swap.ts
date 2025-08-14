import axios from 'axios'
import { EnsoSwapInput, EnsoTxInput, EnsoSwapETHToPTInput, EnsoSwapOutput } from '../types/swap'
import { parseUnits } from 'viem'

export async function ensoSwap(input: EnsoSwapInput) {
  const { chainId, tokenIn, tokenOut, fromAddress, amountIn, slippage, destinationChainId } = input

  // enso use 100 for 1%, original slippage was 0.01 for 1%
  const convertedSlippage = slippage * 10000

  const txData = await axios.get(
    'https://api.enso.finance/api/v1/shortcuts/route',
    {
      params: {
        chainId: chainId,
        fromAddress,
        routingStrategy: 'router',
        receiver: fromAddress,
        spender: fromAddress,
        tokenIn: [tokenIn],
        amountIn: [amountIn],
        tokenOut: [tokenOut],
        slippage: convertedSlippage.toString(),
        destinationChainId: destinationChainId || undefined
      }
    }
  )

  return txData.data as EnsoSwapOutput
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
    const amountIn = parseUnits('900', 18)
    const testInput: EnsoSwapInput = {
      chainId: 137, // Ethereum mainnet
      tokenIn: '0x0000000000000000000000000000000000001010',
      tokenOut: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', 
      fromAddress: '0xFb697a5eD9cdbbA684511774416cf4424052dC45',
      amountIn: amountIn.toString(), 
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

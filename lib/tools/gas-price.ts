import { tool } from 'ai'
import { getProposedGasPrice } from '../etherscan/gas-price'
import { z } from 'zod'

export const getGasPriceTool = tool({
  description: 'Get the proposed gas price',
  parameters: z.object({}),
  execute: async () => {
    const gasPrice = await getProposedGasPrice()

    return {
        gas_price: `${gasPrice} gwei`,
        complete_time: new Date().toISOString()
    }
  }
})

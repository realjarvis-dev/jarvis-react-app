import { tool } from 'ai'
import { z } from 'zod'
import { getProposedGasPrice } from '../etherscan/gas-price'
import { NetworkContext } from '../types/context'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const getGasPriceTool = tool({
  description: 'Get the proposed gas price',
  parameters: z.object({}),
  execute: async (params, context: ToolContext) => {
    const networkContext = context?.networkContext;
    
    // Note: For now, this tool only supports Ethereum mainnet gas prices
    // In the future, we could extend this to support other networks
    const gasPrice = await getProposedGasPrice()

    return {
        gas_price: `${gasPrice} gwei`,
        complete_time: new Date().toISOString()
    }
  }
})

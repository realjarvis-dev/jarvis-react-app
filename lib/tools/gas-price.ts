import { tool } from 'ai'
import { z } from 'zod'
import { getGasPriceByChainId } from '../blocknative/get-gas-price'
import { NetworkContext } from '../types/context'
import { formatUnits } from 'viem'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const getGasPriceTool = tool({
  description: 'Get the base gas price and max fee per gas for a given chain',
  parameters: z.object({}),
  execute: async (params, context: ToolContext) => {
    const chainId = context?.networkContext?.selectedChainId;
    const nativeTokenSymbol = context?.networkContext?.config?.nativeAsset.symbol;
    
    let {baseFeePerGas, maxPriceInMemPool, maxPriorityFeePerGas, maxFeePerGas} = await getGasPriceByChainId(chainId || 1)
    const baseFeePerGasGwei = formatUnits(baseFeePerGas, 9)
    const maxPriceInMemPoolGwei = formatUnits(maxPriceInMemPool, 9)
    const maxPriorityFeePerGasGwei = formatUnits(maxPriorityFeePerGas, 9)
    const maxFeePerGasGwei = formatUnits(maxFeePerGas, 9)
    return {
        base_fee_per_gas: `${baseFeePerGasGwei} gwei ${nativeTokenSymbol}`,
        max_fee_per_gas: `${maxFeePerGasGwei} gwei ${nativeTokenSymbol}`,
        complete_time: new Date().toISOString()
    }
  }
})

import { tool } from 'ai'
import { z } from 'zod'
import { getGasPriceByChainId } from '../blocknative/get-gas-price'
import { getGasPriceByChainId as getGasPriceByChainIdAlchemy } from '../alchemy/get-gas-price'
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
    let baseFeePerGasGwei = formatUnits(baseFeePerGas, 9)
    let maxPriceInMemPoolGwei = formatUnits(maxPriceInMemPool, 9)
    let maxPriorityFeePerGasGwei = formatUnits(maxPriorityFeePerGas, 9)
    let maxFeePerGasGwei: string | undefined = formatUnits(maxFeePerGas, 9)
    if (chainId === 56) {
      baseFeePerGasGwei = formatUnits(await getGasPriceByChainIdAlchemy(chainId), 9)
      maxFeePerGasGwei = undefined
    }
    return {
        base_fee_per_gas: `${baseFeePerGasGwei} gwei ${nativeTokenSymbol}`,
        max_fee_per_gas: maxFeePerGasGwei ? `${maxFeePerGasGwei} gwei ${nativeTokenSymbol}` : undefined,
        complete_time: new Date().toISOString(),
        chainName: context?.networkContext?.config?.displayName,
        unit: nativeTokenSymbol,
        source: chainId === 56 ? 'alchemy' : 'blocknative'
    }
  }
})

import { tool } from 'ai'
import { z } from 'zod'
import { getUserEvmWalletAddress } from '@/lib/privy/client'
import { NetworkContext } from '@/lib/types/context'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const defillamaYieldExecute = tool({
  description: 'Find and execute the best yield opportunities across multiple blockchain networks. Automatically bridges funds to chains with superior yields using Enso cross-chain routing.',
  parameters: z.object({
    tokenAddress: z.string().describe('Address of the input token'),
    amount: z.string().describe('Amount to invest (in token units)'),
    sourceChainId: z.number().describe('Current chain ID where input token are located'),
    poolId: z.string().describe('Defi Llama pool ID of the target pool to invest in'),

  }),
  execute: async ({ tokenAddress, amount, sourceChainId }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to use cross-chain optimization' }
        }
      }

      } catch (error) {
        console.error(error)
        return {
          _uiDisplayTool: true,
          summary: 'Error',
          data: { error: 'Error executing yield execute' }
        }
      }
    }
})


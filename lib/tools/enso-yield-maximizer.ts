import { tool } from 'ai'
import { z } from 'zod'
import { getStrategyBuilder } from '@/lib/enso'
import { executeTransaction } from '@/lib/privy/utils'
import { getUserEvmWalletAddress } from '@/lib/privy/client'
import { NetworkContext } from '@/lib/types/context'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const ensoYieldMaximizer = tool({
  description: 'Find and execute the highest yielding DeFi opportunities across 140+ protocols using Enso. Automatically routes funds to the best yield-generating positions.',
  parameters: z.object({
    tokenAddress: z.string().describe('Address of the token to optimize yield for (use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee for ETH)'),
    amount: z.string().describe('Amount to invest (in token units, e.g., "1000000000000000000" for 1 ETH)'),
    chainId: z.number().describe('Chain ID (1 for Ethereum, 8453 for Base, 42161 for Arbitrum, etc.)'),
    riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).describe('Investment risk tolerance - conservative (3%+ APY), moderate (5%+ APY), aggressive (8%+ APY)').default('moderate')
  }),
  execute: async ({ tokenAddress, amount, chainId, riskLevel }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to use yield maximization strategies' }
        }
      }

      // Build the yield maximizer strategy
      const strategyBuilder = getStrategyBuilder()
      const strategy = await strategyBuilder.buildYieldMaximizerStrategy(
        userAddress,
        tokenAddress,
        amount,
        chainId,
        riskLevel
      )

      // Check if simulation passed
      if (!strategy.simulation?.canExecute) {
        return {
          _uiDisplayTool: true,
          summary: 'Strategy execution blocked',
          data: {
            error: strategy.simulation?.failureReason || 'Strategy failed simulation checks',
            warnings: strategy.simulation?.warnings || [],
            risks: strategy.simulation?.risks || []
          }
        }
      }

      // If simulation looks good, prepare for execution
      const executionData = {
        strategy: {
          name: strategy.name,
          description: strategy.description,
          expectedAPY: strategy.expectedAPY,
          riskLevel: strategy.riskLevel,
          category: strategy.category
        },
        simulation: {
          canExecute: strategy.simulation.canExecute,
          expectedOutputs: strategy.simulation.expectedOutputs,
          estimatedGas: strategy.simulation.estimatedGas,
          priceImpact: strategy.simulation.priceImpact,
          confidence: strategy.simulation.confidence,
          riskLevel: strategy.simulation.riskLevel,
          warnings: strategy.simulation.warnings,
          risks: strategy.simulation.risks
        },
        transaction: strategy.routeData?.tx,
        protocol: strategy.outputs[0]?.protocol,
        outputToken: strategy.outputs[0]?.symbol
      }

      return {
        _uiDisplayTool: true,
        summary: `Found optimal yield strategy: ${strategy.outputs[0]?.symbol} (${strategy.expectedAPY} APY)`,
        data: executionData
      }

    } catch (error) {
      console.error('Yield maximizer failed:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Failed to find yield opportunities',
        data: { 
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          suggestion: 'Try adjusting the risk level or amount, or check if the token is supported on this chain'
        }
      }
    }
  }
})

export const ensoExecuteStrategy = tool({
  description: 'Execute a previously simulated Enso strategy after user confirmation',
  parameters: z.object({
    transactionData: z.object({
      to: z.string(),
      data: z.string(),
      value: z.string(),
      gas: z.string()
    }).describe('Transaction data from the simulated strategy'),
    strategyName: z.string().describe('Name of the strategy being executed')
  }),
  execute: async ({ transactionData, strategyName }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to execute strategies' }
        }
      }

      // Prepare transaction data in the same format as LiFi
      const txData = {
        to: transactionData.to,
        from: userAddress,
        data: transactionData.data,
        value: BigInt(transactionData.value || '0')
      }

      const chainId = context?.networkContext?.selectedChainId || 1
      const isDemo = context?.networkContext?.selectedNetwork === 'demo'

      // Execute using the same pattern as LiFi - with gas estimation
      const result = await executeTransaction(
        txData,
        chainId,
        {
          estimateGas: !isDemo, // Use gas estimation for non-demo
          gasLimit: isDemo ? transactionData.gas as `0x${string}` : undefined
        },
        isDemo
      )

      return {
        _uiDisplayTool: true,
        summary: `${strategyName} executed successfully`,
        data: {
          success: true,
          transactionHash: result.hash,
          explorerUrl: `https://etherscan.io/tx/${result.hash}`, // TODO: Make chain-specific
          message: 'Transaction submitted! Monitor your wallet for confirmation.'
        }
      }

    } catch (error) {
      console.error('Strategy execution failed:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Strategy execution failed',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          suggestion: 'Check your wallet balance and network connection, then try again'
        }
      }
    }
  }
})
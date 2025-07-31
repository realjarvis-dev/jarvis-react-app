import { tool } from 'ai'
import { z } from 'zod'
import { getStrategyBuilder } from '@/lib/enso'
import { getUserEvmWalletAddress } from '@/lib/privy/client'
import { NetworkContext } from '@/lib/types/context'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

export const ensoCrossChainOptimizer = tool({
  description: 'Find and execute the best yield opportunities across multiple blockchain networks. Automatically bridges funds to chains with superior yields using Enso cross-chain routing.',
  parameters: z.object({
    tokenAddress: z.string().describe('Address of the token to optimize across chains'),
    amount: z.string().describe('Amount to invest (in token units)'),
    sourceChainId: z.number().describe('Current chain ID where tokens are located'),
    targetChainIds: z.array(z.number()).describe('Chain IDs to search for opportunities (e.g., [8453, 42161, 137] for Base, Arbitrum, Polygon)').optional().default([8453, 42161, 137, 10])
  }),
  execute: async ({ tokenAddress, amount, sourceChainId, targetChainIds }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to use cross-chain optimization' }
        }
      }

      // Build cross-chain yield strategy
      const strategyBuilder = getStrategyBuilder()
      const strategy = await strategyBuilder.buildCrossChainYieldStrategy(
        userAddress,
        tokenAddress,
        amount,
        sourceChainId,
        targetChainIds
      )

      // Check simulation results
      if (!strategy.simulation?.canExecute) {
        return {
          _uiDisplayTool: true,
          summary: 'Cross-chain strategy blocked',
          data: {
            error: strategy.simulation?.failureReason || 'Cross-chain strategy failed validation',
            warnings: strategy.simulation?.warnings || [],
            risks: strategy.simulation?.risks || [],
            suggestion: 'Try a different source chain or reduce the amount'
          }
        }
      }

      const sourceChainName = getChainName(sourceChainId)
      const targetChainName = strategy.outputs[0] ? getChainName(getChainIdFromOutput(strategy.outputs[0])) : 'Unknown'

      return {
        _uiDisplayTool: true,
        summary: `Cross-chain opportunity found: ${strategy.outputs[0]?.symbol} on ${targetChainName} (${strategy.expectedAPY} APY)`,
        data: {
          strategy: {
            name: strategy.name,
            description: strategy.description,
            expectedAPY: strategy.expectedAPY,
            riskLevel: strategy.riskLevel,
            category: strategy.category,
            sourceChain: sourceChainName,
            targetChain: targetChainName
          },
          simulation: {
            canExecute: strategy.simulation.canExecute,
            expectedOutputs: strategy.simulation.expectedOutputs,
            estimatedGas: strategy.simulation.estimatedGas,
            priceImpact: strategy.simulation.priceImpact,
            confidence: strategy.simulation.confidence,
            warnings: strategy.simulation.warnings,
            risks: strategy.simulation.risks
          },
          transaction: strategy.routeData?.tx,
          bridgeInfo: {
            from: sourceChainName,
            to: targetChainName,
            protocol: 'Stargate', // Enso uses Stargate for bridging
            estimatedTime: '5-10 minutes'
          },
          outputProtocol: strategy.outputs[0]?.protocol,
          outputToken: strategy.outputs[0]?.symbol
        }
      }

    } catch (error) {
      console.error('Cross-chain optimizer failed:', error)
      
      // Handle specific error cases
      if (error instanceof Error && error.message.includes('No better cross-chain opportunities')) {
        return {
          _uiDisplayTool: true,
          summary: 'No better opportunities found',
          data: {
            message: 'Current chain already has the best available yields for this token',
            suggestion: 'Try a different token or check back later for new opportunities',
            searchedChains: targetChainIds.map(id => getChainName(id))
          }
        }
      }

      return {
        _uiDisplayTool: true,
        summary: 'Cross-chain optimization failed',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          suggestion: 'Check if the token is supported on target chains or try adjusting parameters'
        }
      }
    }
  }
})

export const ensoLPOptimizer = tool({
  description: 'Find and enter the best liquidity provider (LP) positions for maximum yield. Automatically converts tokens to optimal LP positions across DeFi protocols.',
  parameters: z.object({
    tokenAddress: z.string().describe('Address of the token to use for LP position'),
    amount: z.string().describe('Amount to invest in LP position'),
    chainId: z.number().describe('Chain ID for the LP position'),
    preferredProtocol: z.string().describe('Preferred DEX protocol (e.g., "uniswap", "curve", "balancer")').optional()
  }),
  execute: async ({ tokenAddress, amount, chainId, preferredProtocol }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to optimize LP positions' }
        }
      }

      const strategyBuilder = getStrategyBuilder()
      const strategy = await strategyBuilder.buildLPStrategy(
        userAddress,
        tokenAddress,
        amount,
        chainId,
        preferredProtocol
      )

      if (!strategy.simulation?.canExecute) {
        return {
          _uiDisplayTool: true,
          summary: 'LP strategy blocked',
          data: {
            error: strategy.simulation?.failureReason || 'LP strategy failed validation',
            warnings: strategy.simulation?.warnings || [],
            risks: strategy.simulation?.risks || []
          }
        }
      }

      return {
        _uiDisplayTool: true,
        summary: `LP position found: ${strategy.outputs[0]?.symbol} (${strategy.expectedAPY} APY)`,
        data: {
          strategy: {
            name: strategy.name,
            description: strategy.description,
            expectedAPY: strategy.expectedAPY,
            riskLevel: strategy.riskLevel,
            lpToken: strategy.outputs[0]?.symbol,
            protocol: strategy.outputs[0]?.protocol
          },
          simulation: {
            canExecute: strategy.simulation.canExecute,
            expectedOutputs: strategy.simulation.expectedOutputs,
            estimatedGas: strategy.simulation.estimatedGas,
            priceImpact: strategy.simulation.priceImpact,
            confidence: strategy.simulation.confidence,
            warnings: strategy.simulation.warnings,
            risks: strategy.simulation.risks
          },
          transaction: strategy.routeData?.tx,
          risks: {
            impermanentLoss: 'LP positions carry impermanent loss risk',
            priceVolatility: 'Token price movements affect LP value'
          }
        }
      }

    } catch (error) {
      console.error('LP optimizer failed:', error)
      return {
        _uiDisplayTool: true,
        summary: 'LP optimization failed',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          suggestion: 'Try a different protocol or check if sufficient liquidity exists'
        }
      }
    }
  }
})

export const ensoStablecoinOptimizer = tool({
  description: 'Optimize stablecoin yields by finding the highest APY opportunities across lending and yield protocols. Low-risk strategy for stablecoin holders.',
  parameters: z.object({
    stablecoinAddress: z.string().describe('Address of the stablecoin (USDC, USDT, DAI, etc.)'),
    amount: z.string().describe('Amount of stablecoin to optimize'),
    chainId: z.number().describe('Chain ID for optimization')
  }),
  execute: async ({ stablecoinAddress, amount, chainId }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to optimize stablecoin yields' }
        }
      }

      const strategyBuilder = getStrategyBuilder()
      const strategy = await strategyBuilder.buildStablecoinStrategy(
        userAddress,
        stablecoinAddress,
        amount,
        chainId
      )

      if (!strategy.simulation?.canExecute) {
        return {
          _uiDisplayTool: true,
          summary: 'Stablecoin strategy blocked',
          data: {
            error: strategy.simulation?.failureReason || 'Stablecoin strategy failed validation',
            warnings: strategy.simulation?.warnings || [],
            risks: strategy.simulation?.risks || []
          }
        }
      }

      return {
        _uiDisplayTool: true,
        summary: `Stablecoin yield optimized: ${strategy.outputs[0]?.symbol} (${strategy.expectedAPY} APY)`,
        data: {
          strategy: {
            name: strategy.name,
            description: strategy.description,
            expectedAPY: strategy.expectedAPY,
            riskLevel: strategy.riskLevel,
            outputToken: strategy.outputs[0]?.symbol,
            protocol: strategy.outputs[0]?.protocol
          },
          simulation: {
            canExecute: strategy.simulation.canExecute,
            expectedOutputs: strategy.simulation.expectedOutputs,
            estimatedGas: strategy.simulation.estimatedGas,
            priceImpact: strategy.simulation.priceImpact,
            confidence: strategy.simulation.confidence,
            warnings: strategy.simulation.warnings,
            risks: strategy.simulation.risks
          },
          transaction: strategy.routeData?.tx,
          benefits: {
            lowRisk: 'Stablecoin strategies have minimal price volatility risk',
            stable: 'Predictable returns with low impermanent loss'
          }
        }
      }

    } catch (error) {
      console.error('Stablecoin optimizer failed:', error)
      return {
        _uiDisplayTool: true,
        summary: 'Stablecoin optimization failed',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          suggestion: 'Check if the stablecoin is supported or try a different amount'
        }
      }
    }
  }
})

// Helper functions
function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    42161: 'Arbitrum',
    137: 'Polygon',
    10: 'Optimism',
    43114: 'Avalanche',
    56: 'BSC',
    100: 'Gnosis',
    324: 'zkSync Era'
  }
  return chainNames[chainId] || `Chain ${chainId}`
}

function getChainIdFromOutput(output: any): number {
  // This would need to be implemented based on how chain info is stored in strategy outputs
  // For now, return a default
  return 1
}
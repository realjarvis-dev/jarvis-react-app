import { tool } from 'ai'
import { z } from 'zod'
import { ethers } from 'ethers'
import { getStrategyBuilder } from '@/lib/enso'
import { executeTransaction } from '@/lib/privy/utils'
import { getUserEvmWalletAddress, getUserId } from '@/lib/privy/client'
import { NetworkContext } from '@/lib/types/context'
import { getConfigByChainId } from '@/lib/network/config'
import { balanceChangePub } from '@/lib/pubsub/balance-change-pub'
import { getGasPriceByChainId } from '@/lib/blocknative/get-gas-price'

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

      // Extract demo mode from context
      const networkContext = context?.networkContext
      const isDemo = networkContext?.isDemo || false
      
      // In demo mode, use the chain from network context if provided
      const effectiveChainId = isDemo && networkContext?.selectedChainId 
        ? networkContext.selectedChainId 
        : chainId

      console.log('Enso yield maximizer execution:', {
        isDemo,
        originalChainId: chainId,
        effectiveChainId,
        riskLevel
      })

      // Build the yield maximizer strategy
      const strategyBuilder = getStrategyBuilder()
      const strategy = await strategyBuilder.buildYieldMaximizerStrategy(
        userAddress,
        tokenAddress,
        amount,
        effectiveChainId,
        riskLevel,
        isDemo // Pass demo mode to strategy builder
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

      // Debug transaction data
      console.log('Transaction data validation:', {
        hasData: !!transactionData.data,
        dataLength: transactionData.data?.length,
        dataType: typeof transactionData.data,
        to: transactionData.to,
        value: transactionData.value,
        gas: transactionData.gas
      })

      // Validate transaction data before execution
      if (!transactionData.data || transactionData.data === '0x' || transactionData.data === '') {
        return {
          _uiDisplayTool: true,
          summary: 'Invalid transaction data',
          data: {
            error: 'Transaction data is empty. The Enso route may not have been properly generated.',
            suggestion: 'Try regenerating the strategy or check if the token and amount are valid'
          }
        }
      }

      // Prepare transaction data in the same format as LiFi
      const txData = {
        to: transactionData.to,
        from: userAddress,
        data: transactionData.data,
        value: BigInt(transactionData.value || '0')
      }

      // Debug final transaction data
      console.log('Final transaction data being sent:', {
        to: txData.to,
        from: txData.from,
        dataLength: txData.data?.length,
        value: txData.value.toString()
      })

      const networkContext = context?.networkContext
      const chainId = networkContext?.selectedChainId || 1
      const isDemo = networkContext?.isDemo || networkContext?.selectedNetwork === 'demo'

      // Prepare gas limit with proper hex formatting
      let gasLimit: `0x${string}` | undefined = undefined
      if (isDemo && transactionData.gas) {
        // Convert gas to proper hex format for demo mode
        try {
          console.log('Original gas value:', transactionData.gas)
          // Handle both hex (0x...) and decimal string formats
          const gasValue = transactionData.gas.startsWith('0x') 
            ? BigInt(transactionData.gas)
            : BigInt(transactionData.gas)
          gasLimit = ethers.toQuantity(gasValue) as `0x${string}`
          console.log('Converted gas limit:', gasLimit)
        } catch (error) {
          console.warn('Failed to parse gas limit, using fallback:', error)
          gasLimit = ethers.toQuantity(1000000) as `0x${string}` // 1M gas fallback
        }
      }

      // Debug gas prices before execution
      try {
        const gasPrice = await getGasPriceByChainId(chainId)
        console.log('Fetched gas prices:', {
          baseFeePerGas: gasPrice.baseFeePerGas.toString(),
          maxFeePerGas: gasPrice.maxFeePerGas.toString(),
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas.toString(),
          inGwei: {
            baseFeePerGas: (Number(gasPrice.baseFeePerGas) / 1e9).toFixed(3) + ' gwei',
            maxFeePerGas: (Number(gasPrice.maxFeePerGas) / 1e9).toFixed(3) + ' gwei',
            maxPriorityFeePerGas: (Number(gasPrice.maxPriorityFeePerGas) / 1e9).toFixed(3) + ' gwei'
          }
        })
      } catch (gasPriceError) {
        console.error('Failed to fetch gas prices for debugging:', gasPriceError)
      }

      console.log('Enso strategy execution:', {
        isDemo,
        chainId,
        hasGasLimit: !!gasLimit,
        gasLimit,
        estimateGas: !isDemo
      })

      // Create custom gas price function for demo mode
      const createGasPriceFunction = (isDemo: boolean) => {
        return async (chainId: number) => {
          const originalGasPrice = await getGasPriceByChainId(chainId)
          
          if (isDemo) {
            const maxFeeInGwei = Number(originalGasPrice.maxFeePerGas) / 1e9
            
            // If gas prices too low (< 10 gwei), use safe demo values
            if (maxFeeInGwei < 10) {
              console.log('Gas prices too low for demo, using fallback values')
              return {
                baseFeePerGas: ethers.parseUnits('15', 'gwei'), // 15 gwei base
                maxFeePerGas: ethers.parseUnits('20', 'gwei'), // 20 gwei max
                maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'), // 2 gwei priority
                maxPriceInMemPool: ethers.parseUnits('20', 'gwei')
              }
            }
          }
          
          // Use original gas prices if they're adequate
          return originalGasPrice
        }
      }

      // Prepare gas pricing options with demo-aware gas price function
      const gasOptions = {
        estimateGas: !isDemo, // Use gas estimation for non-demo
        gasLimit,
        eip1559GasPriceFunction: createGasPriceFunction(isDemo)
      }

      console.log('Final gas options:', { 
        estimateGas: gasOptions.estimateGas,
        hasGasLimit: !!gasOptions.gasLimit,
        gasLimit: gasOptions.gasLimit
      })

      // Execute transaction
      const result = await executeTransaction(txData, chainId, gasOptions, isDemo)

      // Build proper explorer link based on chain and demo mode
      const config = getConfigByChainId(chainId, isDemo)
      const explorerUrl = `https://${config.scanLink}/tx/${result.hash}`

      // Publish balance change event
      const userId = await getUserId()
      if (userId) {
        balanceChangePub(userId, [config.id], isDemo)
      }

      return {
        _uiDisplayTool: true,
        summary: `${strategyName} executed successfully`,
        data: {
          success: true,
          transactionHash: result.hash,
          explorerUrl,
          chainId,
          message: isDemo 
            ? 'Demo transaction executed successfully! No real funds were moved.'
            : 'Transaction submitted! Monitor your wallet for confirmation.'
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
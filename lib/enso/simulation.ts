import { Tenderly } from '@tenderly/sdk'
import { getEnsoClient } from './client'
import {
  EnsoSimulationResult,
  EnsoStrategy,
  EnsoRouteResponse,
  EnsoBundleResponse
} from './types'

export class EnsoSimulationService {
  private tenderly: Tenderly | null = null

  constructor() {
    // Initialize Tenderly only if credentials are available
    if (this.hasTenderlyCredentials()) {
      this.tenderly = new Tenderly({
        accessKey: process.env.TENDERLY_API_KEY!,
        accountName: process.env.TENDERLY_ACCOUNT_ID!,
        projectName: process.env.TENDERLY_PROJECT_ID!,
        network: 1
      })
    }
  }

  private hasTenderlyCredentials(): boolean {
    return !!(
      process.env.TENDERLY_API_KEY &&
      process.env.TENDERLY_ACCOUNT_ID &&
      process.env.TENDERLY_PROJECT_ID
    )
  }

  /**
   * Simulate Enso transaction before execution
   */
  async simulateTransaction(
    transaction: {
      to: string
      data: string
      value: string
      gas: string
    },
    userAddress: string,
    chainId: number,
    strategy?: EnsoStrategy
  ): Promise<EnsoSimulationResult> {
    try {
      // Step 1: Pre-flight validation checks
      const preflightResult = await this.performPreflightChecks(
        userAddress,
        chainId,
        strategy
      )

      if (!preflightResult.canExecute) {
        return {
          success: false,
          canExecute: false,
          estimatedGas: transaction.gas,
          expectedOutputs: [],
          failureReason: preflightResult.failureReason,
          warnings: preflightResult.warnings,
          risks: preflightResult.risks,
          confidence: 0,
          riskLevel: 'high'
        }
      }

      // Step 2: Tenderly simulation (if available)
      let tenderlyResult = null
      if (this.tenderly) {
        tenderlyResult = await this.runTenderlySimulation(
          transaction,
          userAddress,
          chainId
        )
      }

      // Step 3: Analyze expected outputs from Enso response
      const expectedOutputs = this.analyzeExpectedOutputs(strategy)

      // Step 4: Calculate risk assessment
      const riskAssessment = this.assessRisks(strategy, tenderlyResult)

      return {
        success: tenderlyResult?.success ?? true,
        canExecute: preflightResult.canExecute && (tenderlyResult?.success ?? true),
        estimatedGas: tenderlyResult?.gasUsed || transaction.gas,
        expectedOutputs,
        priceImpact: strategy?.routeData?.priceImpact,
        failureReason: tenderlyResult?.error || preflightResult.failureReason,
        warnings: [
          ...preflightResult.warnings,
          ...this.generateWarnings(strategy, tenderlyResult)
        ],
        risks: riskAssessment.risks,
        stepResults: this.analyzeStepResults(strategy, tenderlyResult),
        confidence: this.calculateConfidence(strategy, tenderlyResult, preflightResult),
        riskLevel: riskAssessment.riskLevel
      }
    } catch (error) {
      console.error('Simulation failed:', error)
      return {
        success: false,
        canExecute: false,
        estimatedGas: transaction.gas,
        expectedOutputs: [],
        failureReason: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings: ['Unable to simulate transaction'],
        risks: [{ type: 'high', message: 'Simulation unavailable - proceed with caution' }],
        confidence: 0,
        riskLevel: 'high'
      }
    }
  }

  private async performPreflightChecks(
    userAddress: string,
    chainId: number,
    strategy?: EnsoStrategy
  ): Promise<{
    canExecute: boolean
    failureReason?: string
    warnings: string[]
    risks: Array<{ type: 'high' | 'medium' | 'low'; message: string }>
  }> {
    const warnings: string[] = []
    const risks: Array<{ type: 'high' | 'medium' | 'low'; message: string }> = []

    try {
      // Check 1: User balance validation
      if (strategy?.inputs) {
        const ensoClient = getEnsoClient()
        const balances = await ensoClient.getBalances({
          chainId,
          eoaAddress: userAddress,
          useEoa: true
        })

        for (const input of strategy.inputs) {
          const balance = balances.find(b => 
            b.token.toLowerCase() === input.token.toLowerCase()
          )

          if (!balance || parseFloat(balance.amount) < parseFloat(input.amount)) {
            return {
              canExecute: false,
              failureReason: `Insufficient ${input.symbol} balance. Required: ${input.amount}, Available: ${balance?.amount || '0'}`,
              warnings,
              risks
            }
          }
        }
      }

      // Check 2: Strategy-specific validations
      if (strategy) {
        if (strategy.riskLevel === 'high') {
          risks.push({
            type: 'high',
            message: 'High-risk strategy - potential for significant losses'
          })
        }

        if (strategy.category === 'leverage') {
          risks.push({
            type: 'medium',
            message: 'Leveraged position - liquidation risk exists'
          })
        }

        if (strategy.category === 'crosschain') {
          warnings.push('Cross-chain transaction - may take several minutes to complete')
        }
      }

      // Check 3: Network congestion
      warnings.push('Always verify transaction details before signing')

      return {
        canExecute: true,
        warnings,
        risks
      }
    } catch (error) {
      return {
        canExecute: false,
        failureReason: `Pre-flight check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings,
        risks
      }
    }
  }

  private async runTenderlySimulation(
    transaction: {
      to: string
      data: string
      value: string
      gas: string
    },
    userAddress: string,
    chainId: number
  ): Promise<{
    success: boolean
    gasUsed: string
    error?: string
    logs?: any[]
    balanceChanges?: any[]
  }> {
    if (!this.tenderly) {
      throw new Error('Tenderly not configured')
    }

    try {
      const simulation = await this.tenderly.simulator.simulateTransaction({
        network_id: chainId.toString(),
        from: userAddress,
        to: transaction.to,
        input: transaction.data,
        value: transaction.value,
        gas: parseInt(transaction.gas),
        save: true,
        save_if_fails: true
      } as any)

      return {
        success: simulation?.status || false,
        gasUsed: simulation?.gasUsed?.toString() || '0',
        logs: simulation?.logs || [],
        balanceChanges: (simulation as any)?.balance_changes || [],
        error: simulation?.status ? undefined : 'Transaction simulation failed'
      }
    } catch (error) {
      return {
        success: false,
        gasUsed: transaction.gas,
        error: error instanceof Error ? error.message : 'Simulation failed'
      }
    }
  }

  private analyzeExpectedOutputs(strategy?: EnsoStrategy) {
    if (!strategy) return []

    const outputs: Array<{ token: string; amount: string; usdValue: string; symbol: string }> = []

    // From route data
    if (strategy.routeData?.amountOut && strategy.outputs) {
      strategy.outputs.forEach((output, index) => {
        const amount = strategy.routeData?.amountOut[index] || '0'
        outputs.push({
          token: output.token,
          amount,
          usdValue: '0', // Would need price calculation
          symbol: output.symbol
        })
      })
    }

    return outputs
  }

  private assessRisks(
    strategy?: EnsoStrategy,
    tenderlyResult?: any
  ): {
    risks: Array<{ type: 'high' | 'medium' | 'low'; message: string }>
    riskLevel: 'low' | 'medium' | 'high'
  } {
    const risks: Array<{ type: 'high' | 'medium' | 'low'; message: string }> = []
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    if (!strategy) {
      return { risks, riskLevel }
    }

    // Strategy-based risks
    if (strategy.riskLevel === 'high') {
      riskLevel = 'high'
      risks.push({
        type: 'high' as const,
        message: 'High-risk strategy with potential for significant losses'
      })
    }

    if (strategy.category === 'leverage') {
      riskLevel = 'medium'
      risks.push({
        type: 'medium' as const,
        message: 'Leveraged position carries liquidation risk'
      })
    }

    // Price impact risks
    if (strategy.routeData?.priceImpact) {
      const priceImpact = parseFloat(strategy.routeData.priceImpact)
      if (priceImpact > 5) {
        riskLevel = 'high'
        risks.push({
          type: 'high' as const,
          message: `High price impact: ${priceImpact.toFixed(2)}%`
        })
      } else if (priceImpact > 2) {
        risks.push({
          type: 'medium' as const,
          message: `Moderate price impact: ${priceImpact.toFixed(2)}%`
        })
      }
    }

    // Simulation-based risks
    if (tenderlyResult && !tenderlyResult.success) {
      riskLevel = 'high'
      risks.push({
        type: 'high' as const,
        message: 'Transaction simulation failed - high risk of failure'
      })
    }

    return { risks, riskLevel }
  }

  private generateWarnings(strategy?: EnsoStrategy, tenderlyResult?: any): string[] {
    const warnings = []

    if (strategy?.category === 'crosschain') {
      warnings.push('Cross-chain operations may take 5-10 minutes to complete')
    }

    if (strategy?.walletType === 'SmartWallet') {
      warnings.push('This strategy requires a Smart Wallet for optimal execution')
    }

    if (tenderlyResult && tenderlyResult.gasUsed) {
      const gasUsed = parseInt(tenderlyResult.gasUsed)
      if (gasUsed > 500000) {
        warnings.push('High gas usage - transaction may be expensive')
      }
    }

    return warnings
  }

  private analyzeStepResults(strategy?: EnsoStrategy, tenderlyResult?: any) {
    if (!strategy?.routeData?.route) return undefined

    return strategy.routeData.route.map((step, index) => ({
      step: index + 1,
      action: step.action,
      protocol: step.protocol,
      status: 'simulated' as const,
      gasUsed: step.gas,
      output: step.amountOut
    }))
  }

  private calculateConfidence(
    strategy?: EnsoStrategy,
    tenderlyResult?: any,
    preflightResult?: any
  ): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence for successful checks
    if (preflightResult?.canExecute) confidence += 0.3
    if (tenderlyResult?.success) confidence += 0.3
    if (strategy?.routeData) confidence += 0.2

    // Decrease confidence for risks
    if (strategy?.riskLevel === 'high') confidence -= 0.2
    if (strategy?.category === 'leverage') confidence -= 0.1

    return Math.max(0, Math.min(1, confidence))
  }
}

// Singleton instance
let simulationService: EnsoSimulationService | null = null

export function getSimulationService(): EnsoSimulationService {
  if (!simulationService) {
    simulationService = new EnsoSimulationService()
  }
  return simulationService
}

export default EnsoSimulationService
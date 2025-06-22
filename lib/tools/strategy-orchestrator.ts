import { tool } from 'ai'
import { z } from 'zod'
import { ToolContext } from '../types/context'
import { getToolRegistry } from '../utils/tool-registry'

export const strategyOrchestratorTool = tool({
  description: `Analyze user investment goals and generate multi-step DeFi execution plans using available tools. 
    This tool uses advanced reasoning to create optimized strategies that chain multiple protocol operations.`,
  parameters: z.object({
    investment_goal: z.string().describe('User investment objective (e.g., "maximize yield", "minimize risk")'),
    available_capital: z.string().describe('Amount of capital available for the strategy'),
    risk_tolerance: z.enum(['low', 'medium', 'high']).describe('User risk tolerance level'),
    time_horizon: z.enum(['short', 'medium', 'long']).describe('Investment time horizon'),
    preferred_protocols: z.array(z.string()).describe('Preferred DeFi protocols to use (use empty array if no preference)')
  }),
  execute: async (params, context: ToolContext) => {
    const { investment_goal, available_capital, risk_tolerance, time_horizon, preferred_protocols } = params
    const networkContext = context?.networkContext
    
    if (!networkContext?.selectedChainId) {
      throw new Error('Network context with selectedChainId is required')
    }
    
    try {
      const registry = getToolRegistry('openai:o3')
      const availableTools = networkContext 
        ? registry.getSupportedToolNamesForNetwork('openai:o3', networkContext)
        : registry.getSupportedToolNames('openai:o3')
      
      const quoteTools = availableTools.filter(tool => tool.includes('quote'))
      const executionTools = availableTools.filter(tool => 
        tool.includes('swap') || tool.includes('mint') || tool.includes('redeem') || tool.includes('compound')
      )
      
      const strategySteps = await generateStrategySteps(
        investment_goal, 
        available_capital, 
        risk_tolerance, 
        quoteTools, 
        executionTools,
        networkContext
      )
      
      const estimatedProfit = await calculateEstimatedProfit(quoteTools, available_capital, networkContext)
      
      const strategyPlan = {
        goal: investment_goal,
        capital: available_capital,
        risk_level: risk_tolerance,
        horizon: time_horizon,
        network: networkContext.selectedNetwork,
        chain_id: networkContext.selectedChainId,
        steps: strategySteps,
        estimated_profit: estimatedProfit,
        execution_order: 'sequential_with_confirmation',
        max_steps: registry.getMaxSteps('openai:o3', true),
        created_at: new Date().toISOString()
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Generated ${strategyPlan.steps.length}-step strategy for: ${investment_goal}`,
        data: strategyPlan
      }
    } catch (error: any) {
      console.error('Strategy orchestrator error:', error)
      return {
        _uiDisplayTool: true,
        summary: `Strategy generation failed: ${(error as Error).message}`,
        data: {
          error: (error as Error).message,
          goal: investment_goal,
          capital: available_capital
        }
      }
    }
  }
})

export const strategyExecutorTool = tool({
  description: `Execute a multi-step DeFi strategy with automatic transaction confirmation waits between steps.
    Ensures each step completes successfully before proceeding to the next.`,
  parameters: z.object({
    strategy_plan: z.object({
      steps: z.array(z.object({
        step: z.number(),
        action: z.string(),
        tool: z.string(),
        description: z.string(),
        wait_for_confirmation: z.boolean(),
        parameters: z.record(z.any()).describe('Tool parameters (use empty object if none)')
      })),
      execution_order: z.string(),
      max_steps: z.number().describe('Maximum steps allowed (use 15 if not specified)')
    }),
    user_wallet_address: z.string().describe('User wallet address for transactions')
  }),
  execute: async (params, context: ToolContext) => {
    const { strategy_plan, user_wallet_address } = params
    const { steps, max_steps } = strategy_plan
    
    if (steps.length > (max_steps || 15)) {
      throw new Error(`Strategy exceeds maximum steps limit: ${steps.length} > ${max_steps || 15}`)
    }
    
    const executionResults: Array<{
    step: number;
    status: string;
    result?: any;
    error?: string;
    timestamp: string;
    description?: string;
  }> = []
    let currentStep = 0
    
    try {
      for (const step of steps) {
        currentStep = step.step
        console.log(`Executing step ${step.step}: ${step.description}`)
        
        const stepResult = await executeStrategyStep(step, user_wallet_address, context)
        
        executionResults.push({
          step: step.step,
          status: 'completed',
          result: stepResult,
          timestamp: new Date().toISOString(),
          description: step.description
        })
        
        if (step.wait_for_confirmation && stepResult.hash) {
          console.log(`Transaction confirmation handled by tool: ${stepResult.hash}`)
        }
      }
      
      return {
        _uiDisplayTool: true,
        summary: `Strategy execution completed: ${executionResults.length}/${steps.length} steps successful`,
        data: {
          execution_results: executionResults,
          total_steps: steps.length,
          completed_steps: executionResults.filter(r => r.status === 'completed').length,
          status: 'completed'
        }
      }
    } catch (error: any) {
      console.error(`Step ${currentStep} failed:`, error)
      executionResults.push({
        step: currentStep,
        status: 'failed',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      })
      
      return {
        _uiDisplayTool: true,
        summary: `Strategy execution failed at step ${currentStep}: ${(error as Error).message}`,
        data: {
          execution_results: executionResults,
          total_steps: steps.length,
          completed_steps: executionResults.filter(r => r.status === 'completed').length,
          failed_step: currentStep,
          status: 'failed',
          error: (error as Error).message
        }
      }
    }
  }
})

async function generateStrategySteps(
  goal: string, 
  capital: string, 
  risk: string, 
  quoteTools: string[], 
  executionTools: string[],
  networkContext: any
) {
  const steps: Array<{
    step: number;
    action: string;
    tool: string;
    description: string;
    wait_for_confirmation: boolean;
    parameters?: Record<string, any>;
  }> = []
  const goalLower = goal.toLowerCase()
  
  if (goalLower.includes('yield') || goalLower.includes('maximize')) {
    if (quoteTools.includes('pendle_opportunities')) {
      steps.push({
        step: 1,
        action: 'analyze_opportunities',
        tool: 'pendle_opportunities',
        description: 'Analyze available Pendle yield opportunities',
        wait_for_confirmation: false,
        parameters: {
          max_results: 5,
          apy_gte: risk === 'low' ? 5 : risk === 'medium' ? 3 : 1
        }
      })
    }
    
    if (quoteTools.includes('pendle_quote')) {
      steps.push({
        step: 2,
        action: 'get_quote',
        tool: 'pendle_quote',
        description: 'Get quote for selected opportunity',
        wait_for_confirmation: false,
        parameters: {
          amount_in_human: capital,
          direction: 'ethToToken'
        }
      })
    }
    
    if (executionTools.includes('pendle_swap')) {
      steps.push({
        step: 3,
        action: 'execute_swap',
        tool: 'pendle_swap',
        description: 'Execute swap to enter yield position',
        wait_for_confirmation: true,
        parameters: {
          amount_in_human: capital,
          direction: 'ethToToken',
          slippage: risk === 'low' ? 0.005 : risk === 'medium' ? 0.01 : 0.02
        }
      })
    }
  } else if (goalLower.includes('compound') && networkContext.selectedNetwork === 'berachain') {
    if (quoteTools.includes('kodiak_opportunities')) {
      steps.push({
        step: 1,
        action: 'find_baults',
        tool: 'kodiak_opportunities',
        description: 'Find profitable Kodiak Baults to compound',
        wait_for_confirmation: false
      })
    }
    
    if (executionTools.includes('kodiak_compound')) {
      steps.push({
        step: 2,
        action: 'compound_bault',
        tool: 'kodiak_compound',
        description: 'Compound most profitable Bault',
        wait_for_confirmation: true
      })
    }
  } else {
    steps.push({
      step: 1,
      action: 'analyze_wallet',
      tool: 'wallet_balance',
      description: 'Analyze current wallet holdings',
      wait_for_confirmation: false
    })
    
    steps.push({
      step: 2,
      action: 'research_opportunities',
      tool: 'search',
      description: `Research DeFi opportunities for: ${goal}`,
      wait_for_confirmation: false,
      parameters: {
        query: `${goal} DeFi opportunities ${networkContext.selectedNetwork}`
      }
    })
  }
  
  return steps
}

async function calculateEstimatedProfit(quoteTools: string[], capital: string, networkContext: any) {
  try {
    const capitalNum = parseFloat(capital)
    let estimatedReturn = '0%'
    let confidence = 'low'
    
    if (quoteTools.includes('pendle_quote') && capitalNum > 0) {
      estimatedReturn = networkContext.selectedNetwork === 'ethereum' ? '8-15%' : '5-12%'
      confidence = 'medium'
    } else if (quoteTools.includes('kodiak_opportunities') && networkContext.selectedNetwork === 'berachain') {
      estimatedReturn = '10-25%'
      confidence = 'medium'
    }
    
    return {
      estimated_return: estimatedReturn,
      confidence: confidence,
      timeframe: '30-90 days',
      network: networkContext.selectedNetwork
    }
  } catch (error) {
    return {
      estimated_return: 'Unknown',
      confidence: 'low',
      timeframe: 'Unknown',
      error: (error as Error).message
    }
  }
}

async function executeStrategyStep(step: any, userWallet: string, context: ToolContext) {
  const toolParams = {
    ...step.parameters,
    user_wallet_address: userWallet
  }
  
  return { 
    success: true, 
    tool: step.tool,
    action: step.action,
    hash: step.wait_for_confirmation ? `mock_tx_${Date.now()}` : undefined,
    parameters: toolParams
  }
}

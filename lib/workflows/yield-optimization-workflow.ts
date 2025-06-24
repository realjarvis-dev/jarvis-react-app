import { WorkflowDefinition, YieldWorkflow, WorkflowStep } from '../types/workflow'

export const yieldOptimizationWorkflowDefinition: WorkflowDefinition = {
  name: 'yield_optimization',
  description: 'Automated yield optimization strategy using Pendle PT/YT tokens',
  category: 'yield',
  riskLevel: 'medium',
  estimatedTime: 300, // 5 minutes
  steps: [
    {
      id: 'strategy_planning',
      type: 'action',
      tool: 'yield_strategy_planner',
      description: 'Analyze user goals and create investment strategy',
      autoExecute: true,
      params: {
        analysis_type: 'yield_optimization'
      }
    },
    {
      id: 'scan_opportunities',
      type: 'action',
      tool: 'pendle_opportunities',
      description: 'Scan for best Pendle yield opportunities',
      dependencies: ['strategy_planning'],
      autoExecute: true,
      params: {
        limit: 10,
        minApy: 0.05
      }
    },
    {
      id: 'get_swap_quote',
      type: 'action',
      tool: 'pendle_quote',
      description: 'Get quote for ETH to PT+YT swap',
      dependencies: ['scan_opportunities'],
      autoExecute: true
    },
    {
      id: 'evaluate_profitability',
      type: 'decision',
      tool: 'yield_profitability_analyzer',
      description: 'Evaluate if the strategy is profitable',
      dependencies: ['get_swap_quote'],
      autoExecute: true
    },
    {
      id: 'approve_tokens',
      type: 'action',
      tool: 'token_approval',
      description: 'Approve tokens for Pendle swap',
      dependencies: ['evaluate_profitability'],
      requiresApproval: true,
      conditional: 'if_profitable'
    },
    {
      id: 'execute_pt_yt_swap',
      type: 'action',
      tool: 'pendle_swap',
      description: 'Swap ETH for PT+YT tokens',
      dependencies: ['approve_tokens'],
      requiresApproval: true,
      retryPolicy: {
        maxRetries: 2,
        backoff: 'exponential',
        baseDelay: 5000
      }
    },
    {
      id: 'evaluate_yt_sale',
      type: 'decision',
      tool: 'yt_sale_analyzer',
      description: 'Evaluate if selling YT tokens is profitable',
      dependencies: ['execute_pt_yt_swap'],
      autoExecute: true
    },
    {
      id: 'sell_yt_tokens',
      type: 'action',
      tool: 'pendle_swap',
      description: 'Sell YT tokens for ETH if profitable',
      dependencies: ['evaluate_yt_sale'],
      requiresApproval: true,
      conditional: 'if_profitable'
    },
    {
      id: 'setup_position_tracking',
      type: 'action',
      tool: 'position_tracker',
      description: 'Set up tracking for PT tokens until maturity',
      dependencies: ['execute_pt_yt_swap'],
      autoExecute: true
    }
  ]
}

export const compoundingWorkflowDefinition: WorkflowDefinition = {
  name: 'automated_compounding',
  description: 'Automated yield compounding for existing positions',
  category: 'automation',
  riskLevel: 'low',
  estimatedTime: 120, // 2 minutes
  steps: [
    {
      id: 'check_positions',
      type: 'action',
      tool: 'portfolio_analyzer',
      description: 'Check current yield positions',
      autoExecute: true
    },
    {
      id: 'calculate_compound_profitability',
      type: 'decision',
      tool: 'compound_profitability_checker',
      description: 'Check if compounding is profitable after gas costs',
      dependencies: ['check_positions'],
      autoExecute: true
    },
    {
      id: 'execute_compound',
      type: 'action',
      tool: 'kodiak_compound_bault',
      description: 'Compound yield rewards',
      dependencies: ['calculate_compound_profitability'],
      requiresApproval: true,
      conditional: 'if_profitable'
    }
  ]
}

export const crossProtocolArbitrageWorkflowDefinition: WorkflowDefinition = {
  name: 'cross_protocol_arbitrage',
  description: 'Find and execute arbitrage opportunities across DeFi protocols',
  category: 'arbitrage',
  riskLevel: 'high',
  estimatedTime: 180, // 3 minutes
  steps: [
    {
      id: 'scan_arbitrage_opportunities',
      type: 'action',
      tool: 'multi_protocol_scanner',
      description: 'Scan for arbitrage opportunities across protocols',
      autoExecute: true,
      params: {
        protocols: ['pendle', 'kodiak', 'uniswap'],
        minProfitThreshold: 0.02
      }
    },
    {
      id: 'calculate_arbitrage_profit',
      type: 'decision',
      tool: 'arbitrage_profit_calculator',
      description: 'Calculate net profit after gas and slippage',
      dependencies: ['scan_arbitrage_opportunities'],
      autoExecute: true
    },
    {
      id: 'execute_arbitrage',
      type: 'action',
      tool: 'multi_step_arbitrage_executor',
      description: 'Execute arbitrage trades',
      dependencies: ['calculate_arbitrage_profit'],
      requiresApproval: true,
      conditional: 'if_profitable'
    }
  ]
}

export function createYieldOptimizationWorkflow(
  workflowId: string,
  userId: string,
  params?: {
    investmentAmount?: string
    timeHorizon?: 'short' | 'medium' | 'long'
    riskTolerance?: 'conservative' | 'moderate' | 'aggressive'
    preferredProtocols?: string[]
    autoExecuteEnabled?: boolean
  }
): YieldWorkflow {
  const workflow: YieldWorkflow = {
    id: workflowId,
    name: 'Yield Optimization Strategy',
    description: 'Automated yield optimization using Pendle PT/YT strategy',
    trigger: {
      type: 'manual'
    },
    steps: yieldOptimizationWorkflowDefinition.steps.map(step => ({
      ...step,
      params: {
        ...step.params,
        ...params
      }
    })),
    state: {
      status: 'created',
      stepResults: {},
      errors: [],
      metadata: {
        investmentAmount: params?.investmentAmount,
        timeHorizon: params?.timeHorizon,
        riskTolerance: params?.riskTolerance,
        preferredProtocols: params?.preferredProtocols,
        autoExecuteEnabled: params?.autoExecuteEnabled || false
      }
    },
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  return workflow
}

export function createCompoundingWorkflow(
  workflowId: string,
  userId: string,
  params?: {
    minProfitThreshold?: number
    protocols?: string[]
  }
): YieldWorkflow {
  return {
    id: workflowId,
    name: 'Automated Compounding',
    description: 'Automated yield compounding for existing positions',
    trigger: {
      type: 'scheduled',
      schedule: 'every 1 hour',
      conditions: ['yield > gas_cost * 1.5']
    },
    steps: compoundingWorkflowDefinition.steps,
    state: {
      status: 'created',
      stepResults: {},
      errors: [],
      metadata: {
        minProfitThreshold: params?.minProfitThreshold || 0.01,
        protocols: params?.protocols || ['pendle', 'kodiak']
      }
    },
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

// Workflow detection patterns
export const workflowDetectionPatterns = {
  yieldOptimization: [
    /find.*best.*yield/i,
    /optimize.*yield/i,
    /yield.*optimization/i,
    /maximize.*returns/i,
    /best.*investment.*strategy/i,
    /pendle.*strategy/i,
    /pt.*yt.*strategy/i
  ],
  compounding: [
    /compound.*yield/i,
    /auto.*compound/i,
    /compound.*rewards/i,
    /reinvest.*yields/i
  ],
  arbitrage: [
    /arbitrage.*opportunities/i,
    /cross.*protocol.*arbitrage/i,
    /find.*arbitrage/i,
    /price.*differences/i
  ]
}

export function detectWorkflowIntent(message: string): string | null {
  const lowercaseMessage = message.toLowerCase()
  
  for (const pattern of workflowDetectionPatterns.yieldOptimization) {
    if (pattern.test(lowercaseMessage)) {
      return 'yield_optimization'
    }
  }
  
  for (const pattern of workflowDetectionPatterns.compounding) {
    if (pattern.test(lowercaseMessage)) {
      return 'automated_compounding'
    }
  }
  
  for (const pattern of workflowDetectionPatterns.arbitrage) {
    if (pattern.test(lowercaseMessage)) {
      return 'cross_protocol_arbitrage'
    }
  }
  
  return null
}
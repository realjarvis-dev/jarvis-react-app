import { ToolContext } from './context'

export type WorkflowStepType = 'condition' | 'action' | 'decision'
export type WorkflowStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
export type WorkflowStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed'

export interface WorkflowStep {
  id: string
  type: WorkflowStepType
  tool: string
  description: string
  params?: Record<string, any>
  dependencies?: string[]
  onSuccess?: string[]
  onFailure?: string[]
  requiresApproval?: boolean
  autoExecute?: boolean
  conditional?: string // e.g., 'if_profitable', 'if_gas_low'
  retryPolicy?: {
    maxRetries: number
    backoff: 'linear' | 'exponential'
    baseDelay: number
  }
}

export interface WorkflowTrigger {
  type: 'manual' | 'scheduled' | 'event'
  schedule?: string
  conditions?: string[]
}

export interface YieldWorkflow {
  id: string
  name: string
  description: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  state: WorkflowState
  userId?: string
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowState {
  status: WorkflowStatus
  currentStepId?: string
  stepResults: Record<string, any>
  errors: WorkflowError[]
  startedAt?: Date
  completedAt?: Date
  metadata: Record<string, any>
}

export interface WorkflowContext extends ToolContext {
  workflowId: string
  userId: string
  currentStep: number
  workflowState: Record<string, any>
  transactionHistory: TransactionRecord[]
  pendingApprovals: ApprovalRequest[]
  yieldTargets?: YieldTarget[]
  riskLimits?: RiskLimits
  autoExecuteEnabled: boolean
}

export interface WorkflowError {
  stepId: string
  error: string
  timestamp: Date
  retryCount: number
}

export interface TransactionRecord {
  stepId: string
  txHash: string
  chainId: number
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: Date
}

export interface ApprovalRequest {
  stepId: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  estimatedGas?: number
  timestamp: Date
}

export interface YieldTarget {
  minApy: number
  maxRisk: 'low' | 'medium' | 'high'
  timeHorizon: 'short' | 'medium' | 'long'
  preferredProtocols?: string[]
}

export interface RiskLimits {
  maxGasPerHour: number
  maxSlippage: number
  maxPositionSize: number
  requiredApprovals: string[]
}

export interface WorkflowResult {
  workflowId: string
  status: WorkflowStatus
  completedSteps: string[]
  failedSteps: string[]
  results: Record<string, any>
  executionTime: number
  gasCosts: Record<string, number>
}

export interface WorkflowDefinition {
  name: string
  description: string
  category: 'yield' | 'arbitrage' | 'portfolio' | 'automation'
  steps: WorkflowStep[]
  defaultParams?: Record<string, any>
  estimatedTime?: number
  riskLevel: 'low' | 'medium' | 'high'
}
import { 
  WorkflowState, 
  WorkflowContext, 
  YieldWorkflow, 
  WorkflowStepStatus,
  TransactionRecord,
  ApprovalRequest 
} from '../types/workflow'

export class WorkflowStateManager {
  private workflowStates: Map<string, WorkflowState> = new Map()
  private workflowContexts: Map<string, WorkflowContext> = new Map()
  private userWorkflows: Map<string, string[]> = new Map() // userId -> workflowIds[]

  constructor() {
    // In production, this would be backed by Redis or database
    this.initializeStorage()
  }

  private initializeStorage() {
    // Initialize in-memory storage
    // In production, load from persistent storage
  }

  // Workflow state management
  async saveWorkflowState(workflowId: string, state: WorkflowState): Promise<void> {
    state.updatedAt = new Date()
    this.workflowStates.set(workflowId, state)
    
    // In production, persist to Redis/DB
    // await this.persistWorkflowState(workflowId, state)
  }

  async loadWorkflowState(workflowId: string): Promise<WorkflowState | undefined> {
    return this.workflowStates.get(workflowId)
  }

  async updateStepProgress(
    workflowId: string, 
    stepId: string, 
    status: WorkflowStepStatus,
    result?: any,
    error?: string
  ): Promise<void> {
    const state = this.workflowStates.get(workflowId)
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    // Update step result
    if (result) {
      state.stepResults[stepId] = result
    }

    // Add error if present
    if (error) {
      state.errors.push({
        stepId,
        error,
        timestamp: new Date(),
        retryCount: 0
      })
    }

    // Update current step if completed
    if (status === 'completed') {
      state.currentStepId = undefined
    } else if (status === 'in_progress') {
      state.currentStepId = stepId
    }

    await this.saveWorkflowState(workflowId, state)
  }

  // Workflow context management
  async saveWorkflowContext(context: WorkflowContext): Promise<void> {
    this.workflowContexts.set(context.workflowId, context)
    
    // Track user workflows
    const userWorkflows = this.userWorkflows.get(context.userId) || []
    if (!userWorkflows.includes(context.workflowId)) {
      userWorkflows.push(context.workflowId)
      this.userWorkflows.set(context.userId, userWorkflows)
    }
  }

  async loadWorkflowContext(workflowId: string): Promise<WorkflowContext | undefined> {
    return this.workflowContexts.get(workflowId)
  }

  async getUserWorkflows(userId: string): Promise<string[]> {
    return this.userWorkflows.get(userId) || []
  }

  // Transaction tracking
  async addTransactionRecord(
    workflowId: string,
    transaction: TransactionRecord
  ): Promise<void> {
    const context = this.workflowContexts.get(workflowId)
    if (context) {
      context.transactionHistory.push(transaction)
      await this.saveWorkflowContext(context)
    }
  }

  async updateTransactionStatus(
    workflowId: string,
    txHash: string,
    status: 'pending' | 'confirmed' | 'failed'
  ): Promise<void> {
    const context = this.workflowContexts.get(workflowId)
    if (context) {
      const tx = context.transactionHistory.find(t => t.txHash === txHash)
      if (tx) {
        tx.status = status
        await this.saveWorkflowContext(context)
      }
    }
  }

  // Approval management
  async addPendingApproval(
    workflowId: string,
    approval: ApprovalRequest
  ): Promise<void> {
    const context = this.workflowContexts.get(workflowId)
    if (context) {
      context.pendingApprovals.push(approval)
      await this.saveWorkflowContext(context)
    }
  }

  async removePendingApproval(
    workflowId: string,
    stepId: string
  ): Promise<void> {
    const context = this.workflowContexts.get(workflowId)
    if (context) {
      context.pendingApprovals = context.pendingApprovals.filter(
        a => a.stepId !== stepId
      )
      await this.saveWorkflowContext(context)
    }
  }

  async getPendingApprovals(workflowId: string): Promise<ApprovalRequest[]> {
    const context = this.workflowContexts.get(workflowId)
    return context?.pendingApprovals || []
  }

  // Cleanup and maintenance
  async cleanupExpiredWorkflows(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now()
    const expiredWorkflows: string[] = []

    for (const [workflowId, state] of this.workflowStates.entries()) {
      const lastUpdate = state.updatedAt || state.startedAt || new Date()
      if (now - lastUpdate.getTime() > maxAge) {
        expiredWorkflows.push(workflowId)
      }
    }

    for (const workflowId of expiredWorkflows) {
      await this.deleteWorkflow(workflowId)
    }
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    // Remove from state store
    this.workflowStates.delete(workflowId)
    
    // Remove context
    const context = this.workflowContexts.get(workflowId)
    if (context) {
      this.workflowContexts.delete(workflowId)
      
      // Remove from user workflows
      const userWorkflows = this.userWorkflows.get(context.userId) || []
      const updatedUserWorkflows = userWorkflows.filter(id => id !== workflowId)
      this.userWorkflows.set(context.userId, updatedUserWorkflows)
    }
  }

  // Analytics and monitoring
  async getWorkflowMetrics(workflowId: string): Promise<{
    totalSteps: number
    completedSteps: number
    failedSteps: number
    executionTime: number
    totalGasCost: number
    successRate: number
  }> {
    const state = this.workflowStates.get(workflowId)
    const context = this.workflowContexts.get(workflowId)
    
    if (!state || !context) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    const completedSteps = Object.keys(state.stepResults).length
    const failedSteps = state.errors.length
    const totalSteps = completedSteps + failedSteps
    
    const executionTime = state.completedAt && state.startedAt 
      ? state.completedAt.getTime() - state.startedAt.getTime()
      : 0

    const totalGasCost = context.transactionHistory.reduce((total, tx) => {
      // In production, would calculate actual gas costs
      return total + 0 // Placeholder
    }, 0)

    const successRate = totalSteps > 0 ? completedSteps / totalSteps : 0

    return {
      totalSteps,
      completedSteps,
      failedSteps,
      executionTime,
      totalGasCost,
      successRate
    }
  }

  async getUserWorkflowSummary(userId: string): Promise<{
    totalWorkflows: number
    activeWorkflows: number
    completedWorkflows: number
    failedWorkflows: number
  }> {
    const workflowIds = await this.getUserWorkflows(userId)
    
    let activeWorkflows = 0
    let completedWorkflows = 0
    let failedWorkflows = 0

    for (const workflowId of workflowIds) {
      const state = await this.loadWorkflowState(workflowId)
      if (state) {
        switch (state.status) {
          case 'running':
          case 'paused':
            activeWorkflows++
            break
          case 'completed':
            completedWorkflows++
            break
          case 'failed':
            failedWorkflows++
            break
        }
      }
    }

    return {
      totalWorkflows: workflowIds.length,
      activeWorkflows,
      completedWorkflows,
      failedWorkflows
    }
  }

  // Workflow recovery and retry
  async retryFailedStep(
    workflowId: string,
    stepId: string
  ): Promise<void> {
    const state = this.workflowStates.get(workflowId)
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    // Clear previous error for this step
    state.errors = state.errors.filter(error => error.stepId !== stepId)
    
    // Reset step status to allow retry
    delete state.stepResults[stepId]
    
    await this.saveWorkflowState(workflowId, state)
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    const state = this.workflowStates.get(workflowId)
    if (state && state.status === 'running') {
      state.status = 'paused'
      await this.saveWorkflowState(workflowId, state)
    }
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    const state = this.workflowStates.get(workflowId)
    if (state && state.status === 'paused') {
      state.status = 'running'
      await this.saveWorkflowState(workflowId, state)
    }
  }
}

// Singleton instance
export const workflowStateManager = new WorkflowStateManager()
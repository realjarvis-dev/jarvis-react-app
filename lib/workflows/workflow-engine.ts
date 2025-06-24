import { 
  YieldWorkflow, 
  WorkflowStep, 
  WorkflowContext, 
  WorkflowResult, 
  WorkflowState,
  WorkflowStatus,
  WorkflowError,
  ApprovalRequest
} from '../types/workflow'
import { ToolRegistry } from '../utils/tool-registry'
import { ToolContext } from '../types/context'

export class WorkflowEngine {
  private registry: ToolRegistry
  private workflowStates: Map<string, WorkflowState> = new Map()
  private pendingApprovals: Map<string, ApprovalRequest[]> = new Map()

  constructor(registry: ToolRegistry) {
    this.registry = registry
  }

  async executeWorkflow(
    workflow: YieldWorkflow, 
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const startTime = Date.now()
    
    try {
      // Initialize workflow state
      const workflowState: WorkflowState = {
        status: 'running',
        stepResults: {},
        errors: [],
        startedAt: new Date(),
        metadata: {}
      }
      
      this.workflowStates.set(workflow.id, workflowState)
      
      // Execute steps in order, respecting dependencies
      const executionOrder = this.resolveDependencies(workflow.steps)
      const completedSteps: string[] = []
      const failedSteps: string[] = []
      const results: Record<string, any> = {}
      const gasCosts: Record<string, number> = {}

      for (const step of executionOrder) {
        try {
          // Check if step should be executed
          if (!this.shouldExecuteStep(step, results, context)) {
            continue
          }

          // Handle approval requirements
          if (step.requiresApproval && !context.autoExecuteEnabled) {
            const approval = await this.requestApproval(step, workflow.id, context)
            if (!approval) {
              // Step skipped due to lack of approval
              continue
            }
          }

          // Execute the step
          workflowState.currentStepId = step.id
          workflowState.status = 'running'
          
          const stepResult = await this.executeStep(step, context, results)
          
          results[step.id] = stepResult
          completedSteps.push(step.id)
          
          // Track gas costs if available
          if (stepResult.gasCost) {
            gasCosts[step.id] = stepResult.gasCost
          }

        } catch (error) {
          const workflowError: WorkflowError = {
            stepId: step.id,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            retryCount: 0
          }
          
          workflowState.errors.push(workflowError)
          failedSteps.push(step.id)
          
          // Handle step failure
          if (step.onFailure?.length) {
            // Execute failure handlers
            for (const failureStepId of step.onFailure) {
              const failureStep = workflow.steps.find(s => s.id === failureStepId)
              if (failureStep) {
                try {
                  const failureResult = await this.executeStep(failureStep, context, results)
                  results[failureStep.id] = failureResult
                } catch (failureError) {
                  console.error(`Failure handler ${failureStepId} failed:`, failureError)
                }
              }
            }
          }
          
          // Decide whether to continue or abort
          if (!step.retryPolicy || step.retryPolicy.maxRetries === 0) {
            // Abort workflow on critical failure
            workflowState.status = 'failed'
            break
          }
        }
      }

      // Finalize workflow
      const finalStatus: WorkflowStatus = failedSteps.length > 0 ? 'failed' : 'completed'
      workflowState.status = finalStatus
      workflowState.completedAt = new Date()

      return {
        workflowId: workflow.id,
        status: finalStatus,
        completedSteps,
        failedSteps,
        results,
        executionTime: Date.now() - startTime,
        gasCosts
      }

    } catch (error) {
      const workflowState = this.workflowStates.get(workflow.id)
      if (workflowState) {
        workflowState.status = 'failed'
        workflowState.completedAt = new Date()
      }
      
      throw error
    }
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    const state = this.workflowStates.get(workflowId)
    if (state) {
      state.status = 'paused'
      this.workflowStates.set(workflowId, state)
    }
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    const state = this.workflowStates.get(workflowId)
    if (state && state.status === 'paused') {
      state.status = 'running'
      this.workflowStates.set(workflowId, state)
    }
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowState | undefined> {
    return this.workflowStates.get(workflowId)
  }

  private resolveDependencies(steps: WorkflowStep[]): WorkflowStep[] {
    const resolved: WorkflowStep[] = []
    const remaining = [...steps]
    
    while (remaining.length > 0) {
      const canExecute = remaining.filter(step => 
        !step.dependencies || 
        step.dependencies.every(dep => resolved.some(r => r.id === dep))
      )
      
      if (canExecute.length === 0) {
        throw new Error('Circular dependency detected in workflow steps')
      }
      
      resolved.push(...canExecute)
      remaining.splice(0, remaining.length, ...remaining.filter(step => !canExecute.includes(step)))
    }
    
    return resolved
  }

  private shouldExecuteStep(
    step: WorkflowStep, 
    results: Record<string, any>, 
    context: WorkflowContext
  ): boolean {
    // Check conditional execution
    if (step.conditional) {
      return this.evaluateCondition(step.conditional, results, context)
    }
    
    // Check dependencies are met
    if (step.dependencies) {
      return step.dependencies.every(dep => results[dep])
    }
    
    return true
  }

  private evaluateCondition(
    condition: string, 
    results: Record<string, any>, 
    context: WorkflowContext
  ): boolean {
    switch (condition) {
      case 'if_profitable':
        // Check if previous step indicates profitability
        const lastResult = Object.values(results).pop()
        return lastResult?.profitable === true || lastResult?.expectedYield > 0
      
      case 'if_gas_low':
        // Check if gas prices are below threshold
        return context.workflowState.gasPrice < (context.riskLimits?.maxGasPerHour || 100)
      
      default:
        return true
    }
  }

  private async requestApproval(
    step: WorkflowStep, 
    workflowId: string, 
    context: WorkflowContext
  ): Promise<boolean> {
    const approval: ApprovalRequest = {
      stepId: step.id,
      description: step.description,
      riskLevel: this.assessStepRisk(step),
      timestamp: new Date()
    }
    
    // Add to pending approvals
    const pending = this.pendingApprovals.get(workflowId) || []
    pending.push(approval)
    this.pendingApprovals.set(workflowId, pending)
    
    // For now, return true for auto-execution
    // In production, this would integrate with UI approval system
    return step.autoExecute === true
  }

  private assessStepRisk(step: WorkflowStep): 'low' | 'medium' | 'high' {
    // Assess risk based on tool type and parameters
    if (step.tool.includes('swap') || step.tool.includes('bridge')) {
      return 'high'
    } else if (step.tool.includes('quote') || step.tool.includes('opportunities')) {
      return 'low'
    }
    return 'medium'
  }

  private async executeStep(
    step: WorkflowStep, 
    context: WorkflowContext, 
    previousResults: Record<string, any>
  ): Promise<any> {
    // Get the tool from registry
    const tool = this.registry.getTool(step.tool)
    if (!tool) {
      throw new Error(`Tool '${step.tool}' not found in registry`)
    }

    // Prepare parameters, potentially using results from previous steps
    const params = this.prepareStepParams(step, previousResults, context)
    
    // Create tool context
    const toolContext: ToolContext = {
      toolCallId: step.id,
      networkContext: context.networkContext,
      isNewUser: context.isNewUser
    }

    // Execute the tool
    if (tool.execute) {
      return await tool.execute(params, toolContext)
    } else {
      throw new Error(`Tool '${step.tool}' has no execute function`)
    }
  }

  private prepareStepParams(
    step: WorkflowStep, 
    previousResults: Record<string, any>, 
    context: WorkflowContext
  ): any {
    let params = { ...step.params }

    // Inject results from previous steps if needed
    if (step.dependencies) {
      for (const dep of step.dependencies) {
        const depResult = previousResults[dep]
        if (depResult) {
          // Merge relevant data from dependency results
          params = { ...params, ...this.extractRelevantData(depResult, step.tool) }
        }
      }
    }

    return params
  }

  private extractRelevantData(result: any, toolName: string): any {
    // Extract relevant data based on tool requirements
    const extracted: any = {}

    if (result.tokenAddress) extracted.tokenAddress = result.tokenAddress
    if (result.amount) extracted.amount = result.amount
    if (result.optimalStrategy) extracted.strategy = result.optimalStrategy
    if (result.bestOpportunity) extracted.opportunity = result.bestOpportunity

    return extracted
  }
}
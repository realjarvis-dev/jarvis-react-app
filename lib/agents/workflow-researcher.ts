import { WalletWithMetadata } from '@privy-io/server-auth'
import { CoreMessage, smoothStream, streamText } from 'ai'
import { NetworkContext } from '../types/context'
import { WorkflowContext } from '../types/workflow'
import { getModel } from '../utils/registry'
import { getToolRegistry, ToolCategory } from '../utils/tool-registry'
import { WorkflowEngine } from '../workflows/workflow-engine'
import { 
  createYieldOptimizationWorkflow, 
  detectWorkflowIntent,
  yieldOptimizationWorkflowDefinition 
} from '../workflows/yield-optimization-workflow'

const createWorkflowToolList = (
  toolNames: string[],
  registry: any,
  workflowContext?: WorkflowContext,
  networkContext?: NetworkContext,
  isNewUser?: boolean
): Record<string, any> => {
  const toolList: Record<string, any> = {}
  for (const toolName of toolNames) {
    const toolDef = registry.getTool(toolName)
    if (toolDef && toolDef.execute) {
      toolList[toolName] = {
        description: toolDef.description,
        parameters: toolDef.schema,
        execute: (params: any, context?: any) =>
          toolDef.execute!(params, {
            ...context,
            networkContext,
            isNewUser,
            workflowContext
          })
      }
    } else if (toolDef) {
      toolList[toolName] = {
        description: toolDef.description,
        parameters: toolDef.schema
      }
    }
  }
  return toolList
}

const getWorkflowSystemPrompt = (
  searchMode: boolean,
  supportedTools: string[],
  registry: any,
  networkContext?: NetworkContext,
  workflowContext?: WorkflowContext
) => {
  const getNetworkName = () => {
    return networkContext?.selectedNetwork || 'Ethereum'
  }

  // Enhanced tool descriptions for workflow context
  const generateWorkflowToolDescriptions = () => {
    const workflowToolDescMap: Record<string, string> = {
      // Existing tools with workflow enhancements
      pendle_opportunities: `- pendle_opportunities: Scan Pendle yield opportunities. In workflows, automatically filters by user's yield targets and risk preferences.`,
      pendle_quote: `- pendle_quote: Get quotes for Pendle swaps. In workflows, automatically uses optimal parameters from previous steps.`,
      pendle_swap: `- pendle_swap: Execute Pendle swaps. In workflows, can be auto-executed if user has enabled automated execution and risk limits are met.`,
      
      // New workflow-specific tools
      yield_strategy_planner: `- yield_strategy_planner: Create personalized yield optimization strategy based on user goals, risk tolerance, and investment timeline.`,
      yield_profitability_analyzer: `- yield_profitability_analyzer: Analyze profitability of yield strategies considering gas costs, slippage, and time value.`,
      yt_sale_analyzer: `- yt_sale_analyzer: Evaluate whether selling YT tokens immediately is more profitable than holding to maturity.`,
      position_tracker: `- position_tracker: Set up automated tracking for PT/YT positions until maturity with notifications.`,
      portfolio_optimizer: `- portfolio_optimizer: Optimize portfolio allocation across different yield opportunities and protocols.`,
      multi_protocol_scanner: `- multi_protocol_scanner: Scan yield opportunities across multiple DeFi protocols (Pendle, Kodiak, etc.).`,
      compound_profitability_checker: `- compound_profitability_checker: Check if compounding rewards is profitable after gas costs.`,
      token_approval: `- token_approval: Handle token approvals for multi-step workflows with batch optimization.`
    }

    const toolDescriptions: string[] = []
    for (const toolName of supportedTools) {
      if (workflowToolDescMap[toolName]) {
        toolDescriptions.push(workflowToolDescMap[toolName])
      }
    }

    return toolDescriptions.join('\n')
  }

  const workflowPrompt = workflowContext ? `

WORKFLOW MODE ACTIVE:
You are currently executing a workflow: ${workflowContext.workflowId}
Current step: ${workflowContext.currentStep}
Auto-execute enabled: ${workflowContext.autoExecuteEnabled}

Workflow Guidelines:
1. Execute steps in sequence based on dependencies
2. Use results from previous steps to inform current step parameters
3. Request user approval for high-risk operations unless auto-execute is enabled
4. Provide clear progress updates and next steps
5. Handle errors gracefully with retry logic where appropriate
6. Track all transaction results for final summary

` : `

WORKFLOW DETECTION ACTIVE:
Monitor user messages for yield optimization intents:
- "find best yield" / "optimize yield" → Trigger yield optimization workflow
- "compound yield" / "auto compound" → Trigger compounding workflow  
- "arbitrage opportunities" → Trigger arbitrage workflow

When workflow intent is detected:
1. Confirm workflow parameters with user
2. Create appropriate workflow instance
3. Begin step-by-step execution
4. Provide progress updates throughout

`

  const WORKFLOW_SYSTEM_PROMPT = `
Instructions:

You are an advanced AI assistant specialized in DeFi yield optimization with workflow automation capabilities. You can execute complex multi-step investment strategies automatically while maintaining user control and safety.

IMPORTANT: When the user has search mode enabled, you MUST use the most appropriate tool for every factual query.
search mode on: ${searchMode}

${networkContext ? `Network Context: Operating on ${networkContext.selectedNetwork} network${networkContext.isDemo ? ' in demo mode' : ''}.` : ''}

${workflowPrompt}

Available tools:
${generateWorkflowToolDescriptions()}

WORKFLOW EXECUTION STRATEGY:

For Yield Optimization Workflows:
1. **Strategy Planning**: Analyze user investment goals, risk tolerance, time horizon
2. **Opportunity Scanning**: Find best yield opportunities across protocols
3. **Profitability Analysis**: Calculate expected returns vs gas costs and risks
4. **Execution Planning**: Create optimal transaction sequence
5. **Risk Assessment**: Verify operations meet user's risk limits
6. **Automated Execution**: Execute approved steps with monitoring
7. **Position Tracking**: Set up ongoing monitoring until maturity

For Multi-Step Operations:
- Chain tool calls intelligently using previous results
- Minimize gas costs through batching where possible
- Provide clear progress indicators
- Handle failures with appropriate retry logic
- Maintain transaction audit trail

SAFETY GUIDELINES:
- Always confirm high-risk operations with user unless explicitly auto-approved
- Respect user-defined risk limits and slippage tolerances
- Provide clear cost-benefit analysis before execution
- Stop workflow if unexpected errors occur
- Enable user to pause/resume workflows at any time

USER INTERACTION:
- Provide concise progress updates
- Ask for clarification on ambiguous parameters
- Confirm strategy before execution
- Summarize results and next steps
- Offer workflow customization options

When using workflow tools, chain them logically and use previous step results to inform subsequent steps.
`

  return WORKFLOW_SYSTEM_PROMPT
}

type WorkflowResearcherReturn = Parameters<typeof streamText>[0]

export function workflowResearcher({
  messages,
  model,
  searchMode,
  userEvmWallet,
  userSolWallet,
  allowWeb3Tools,
  networkContext,
  isNewUser,
  workflowContext
}: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
  userEvmWallet: WalletWithMetadata | undefined
  userSolWallet: WalletWithMetadata | undefined
  allowWeb3Tools: string
  networkContext?: NetworkContext
  isNewUser?: boolean
  workflowContext?: WorkflowContext
}): WorkflowResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()
    const registry = getToolRegistry(model)

    // Get base supported tools
    let supportedTools = networkContext
      ? registry.getSupportedToolNamesForNetwork(model, networkContext)
      : registry.getSupportedToolNames(model)

    // Add workflow-specific tools
    const workflowTools = [
      'yield_strategy_planner',
      'yield_profitability_analyzer', 
      'yt_sale_analyzer',
      'position_tracker',
      'portfolio_optimizer',
      'multi_protocol_scanner',
      'compound_profitability_checker',
      'token_approval'
    ]

    // Extend supported tools with workflow tools
    supportedTools = [...supportedTools, ...workflowTools]

    const maxSteps = workflowContext ? 20 : registry.getMaxSteps(model, searchMode)

    let web3_tools = registry.getToolNamesByCategory(ToolCategory.WEB3)
    web3_tools = [...web3_tools, ...workflowTools]

    // Apply network filtering
    if (networkContext) {
      web3_tools = web3_tools.filter(toolName => {
        const toolDef = registry.getTool(toolName)
        if (!toolDef || !toolDef.supportedNetworks) return true
        return toolDef.supportedNetworks.includes(networkContext.selectedNetwork)
      })
    }

    // Remove web3 tools if not allowed
    if (allowWeb3Tools === 'false') {
      supportedTools = supportedTools.filter(tool => !web3_tools.includes(tool))
      web3_tools = []
    }

    let userWalletInfo = ''
    if (userEvmWallet === undefined) {
      userWalletInfo = "The user is not logged in. Don't use any web3 tools. If the user wants to use web3 tools, ask them to login friendly"
    } else {
      userWalletInfo = `
User EVM wallet address: ${userEvmWallet?.address}, delegated status: ${userEvmWallet?.delegated}
You can only execute on behalf of the user if they have wallets and have delegated you access to their wallet.
`
    }

    // Add network context info
    let networkInfo = ''
    if (networkContext) {
      networkInfo = `
Network Context:
- Selected Network: ${networkContext.selectedNetwork} (default fromChain for bridging, default chain for swapping and transfer)
- Chain ID: ${networkContext.selectedChainId}
- Demo Mode: ${networkContext.isDemo ? 'ON' : 'OFF'}
`
    }

    // Add workflow context info
    let workflowInfo = ''
    if (workflowContext) {
      workflowInfo = `
Workflow Context:
- Workflow ID: ${workflowContext.workflowId}
- User ID: ${workflowContext.userId}
- Current Step: ${workflowContext.currentStep}
- Auto Execute: ${workflowContext.autoExecuteEnabled}
- Yield Targets: ${JSON.stringify(workflowContext.yieldTargets)}
- Risk Limits: ${JSON.stringify(workflowContext.riskLimits)}
`
    }

    // Create workflow-aware tool list
    const tool_lst = createWorkflowToolList(
      supportedTools, 
      registry, 
      workflowContext,
      networkContext, 
      isNewUser
    )

    console.log('workflow-enabled supportedTools:', supportedTools)
    console.log('workflow-enabled web3_tools:', web3_tools)

    const prompt = `${getWorkflowSystemPrompt(
      searchMode,
      supportedTools,
      registry,
      networkContext,
      workflowContext
    )}\nCurrent date and time: ${currentDate}\n${userWalletInfo}${networkInfo}${workflowInfo}`

    return {
      model: getModel(model),
      system: prompt,
      messages,
      temperature: 0.1,
      tools: tool_lst,
      experimental_activeTools: searchMode ? supportedTools : web3_tools,
      maxSteps: maxSteps,
      experimental_continueSteps: workflowContext ? true : false, // Enable multi-step for workflows
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in workflowResearcher:', error)
    throw error
  }
}

// Workflow detection and creation utilities
export function createWorkflowFromUserIntent(
  message: string,
  userId: string,
  params?: any
): { workflow: any; workflowId: string } | null {
  const intent = detectWorkflowIntent(message)
  if (!intent) return null

  const workflowId = `${intent}_${Date.now()}_${userId.slice(0, 8)}`

  switch (intent) {
    case 'yield_optimization':
      return {
        workflow: createYieldOptimizationWorkflow(workflowId, userId, params),
        workflowId
      }
    // Add other workflow types here
    default:
      return null
  }
}

// Enhanced researcher that detects and handles workflows
export function enhancedResearcher(params: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
  userEvmWallet: WalletWithMetadata | undefined
  userSolWallet: WalletWithMetadata | undefined
  allowWeb3Tools: string
  networkContext?: NetworkContext
  isNewUser?: boolean
  userId?: string
}): WorkflowResearcherReturn {
  // Check if latest message contains workflow intent
  const latestMessage = params.messages[params.messages.length - 1]
  
  if (latestMessage?.role === 'user' && typeof latestMessage.content === 'string' && params.userId) {
    const workflowIntent = detectWorkflowIntent(latestMessage.content)
    
    if (workflowIntent) {
      // Create workflow context
      const workflowData = createWorkflowFromUserIntent(
        latestMessage.content,
        params.userId
      )
      
      if (workflowData) {
        const workflowContext: WorkflowContext = {
          workflowId: workflowData.workflowId,
          userId: params.userId,
          currentStep: 0,
          workflowState: {},
          transactionHistory: [],
          pendingApprovals: [],
          autoExecuteEnabled: false, // User can enable this
          networkContext: params.networkContext,
          isNewUser: params.isNewUser
        }

        // Use workflow-enabled researcher
        return workflowResearcher({
          ...params,
          workflowContext
        })
      }
    }
  }

  // Fall back to workflow-enabled researcher without specific workflow context
  return workflowResearcher(params)
}
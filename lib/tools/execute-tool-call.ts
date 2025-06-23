import {
  CoreMessage,
  DataStreamWriter,
  generateText,
  generateId
} from 'ai'
import { ExtendedCoreMessage } from '../types'
import { getModel, isToolCallSupported } from '../utils/registry'
import { ToolRegistry, getToolRegistry } from '../utils/tool-registry'
import { parseToolCallXml } from '../streaming/parse-tool-call'
import { executeWithRetry, ErrorType, createErrorResponse } from '../utils/error-handling'
import { NetworkContext } from '../types/context'

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  toolCallDataAnnotation: ExtendedCoreMessage | null
  toolCallMessages: CoreMessage[]
}

/**
 * Configuration for dual-model architecture
 */
const PLANNER_MODEL = process.env.PLANNER_MODEL || 'anthropic:claude-opus-4-20250514'
const EXECUTOR_MODEL = process.env.EXECUTOR_MODEL || 'openai:gpt-4o-mini'
const DUAL_MODEL_ENABLED = process.env.DUAL_MODEL_ENABLED === 'true'

// Create a default network context for tools that require it
const defaultNetworkContext: NetworkContext = {
  selectedNetwork: 'ethereum',
  selectedChainId: 1,
  isDemo: false,
  rpcUrl: '',
  config: {} as any
}

/**
 * Main entry point for tool execution with dual-model architecture
 */
export async function executeToolCall(
  msgs: CoreMessage[],
  stream: DataStreamWriter,
  searchMode = false,
  isNewUser = false
): Promise<ToolExecutionResult> {
  if (!searchMode) {
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  if (!DUAL_MODEL_ENABLED) {
    return executeSingleModelToolCall(msgs, stream, EXECUTOR_MODEL, isNewUser)
  }

  const plan = await planToolCallWithClaude(msgs)

  if (!plan.tool || plan.tool === '') {
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  return runPlannedTool(plan, stream, isNewUser)
}

/**
 * Planner helper (Claude 4) - only generates plans, never executes
 */
async function planToolCallWithClaude(msgs: CoreMessage[]): Promise<{ tool: string; parameters: any }> {
  const registry = getToolRegistry(PLANNER_MODEL)
  const availableTools = registry.getSupportedToolNames(PLANNER_MODEL)
  
  const toolSchemasString = availableTools
    .map(toolName => {
      const tool = registry.getTool(toolName)
      if (!tool) return ''
      return `${toolName} parameters:\n${JSON.stringify(tool.schema, null, 2)}`
    })
    .join('\n\n')

  const toolSelectionResponse = await executeWithRetry(
    () => generateText({
      model: getModel(PLANNER_MODEL),
      system: `You are Claude 4, a strategic planner for DeFi operations. Your role is to analyze user requests and select the most appropriate tool with correct parameters.

You excel at understanding investment goals and selecting the right DeFi tools to achieve them.
Current date: ${new Date().toISOString().split('T')[0]}

IMPORTANT: You are a PLANNER only. You do NOT execute tools - you only decide which tool should be used and with what parameters. Another AI model will handle the actual execution.

Do not include any other text in your response.
Respond in XML format with the following structure:
<tool_call>
  <tool>tool_name</tool>
  <parameters>
    ...tool parameters...
  </parameters>
</tool_call>

Available tools:
${availableTools.map(name => {
  const tool = registry.getTool(name)
  return `- ${name}: ${tool?.description || ''}`
}).join('\n')}

${toolSchemasString}

If you don't need a tool, respond with <tool_call><tool></tool></tool_call>`,
      messages: msgs
    }),
    {
      maxRetries: 2,
      initialDelay: 100
    }
  )

  let toolCall, toolName, toolParams
  
  for (const availableTool of availableTools) {
    const tool = registry.getTool(availableTool)
    if (!tool || !tool.schema) continue
    
    try {
      toolCall = parseToolCallXml(toolSelectionResponse.text, tool.schema)
      toolName = toolCall.tool
      toolParams = toolCall.parameters
      
      if (toolName && toolName !== '') {
        break
      }
    } catch (error) {
      console.warn(`Failed to parse tool call for ${availableTool}:`, error)
      continue
    }
  }

  return {
    tool: toolName || '',
    parameters: toolParams || {}
  }
}

/**
 * Executor helper (GPT-4.1) - handles actual tool execution
 */
async function runPlannedTool(
  plan: { tool: string; parameters: any },
  stream: DataStreamWriter,
  isNewUser: boolean
): Promise<ToolExecutionResult> {
  const registry = getToolRegistry(EXECUTOR_MODEL)
  
  const tool = registry.getTool(plan.tool)
  if (!tool) {
    const errorResponse = createErrorResponse(
      ErrorType.NOT_FOUND,
      `Tool ${plan.tool} not found in executor registry`
    )
    
    const toolCallId = `call_${generateId()}`
    const toolCallAnnotation = {
      type: 'tool_call',
      data: {
        state: 'result',
        toolCallId,
        toolName: plan.tool,
        args: JSON.stringify(plan.parameters),
        result: JSON.stringify(errorResponse)
      }
    }
    stream.writeMessageAnnotation(toolCallAnnotation)
    
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  if (isToolCallSupported(EXECUTOR_MODEL)) {
    return executeNativeToolCallWithOpenAI(
      plan.tool, 
      plan.parameters, 
      stream, 
      registry, 
      isNewUser
    )
  }

  return executeManualToolBody(
    plan.tool, 
    plan.parameters, 
    stream, 
    registry, 
    isNewUser
  )
}

/**
 * Native tool calling with OpenAI (GPT-4.1)
 */
async function executeNativeToolCallWithOpenAI(
  toolName: string,
  toolParams: any,
  stream: DataStreamWriter,
  registry: ToolRegistry,
  isNewUser: boolean
): Promise<ToolExecutionResult> {
  const toolCallId = `call_${generateId()}`
  const toolCallAnnotation = {
    type: 'tool_call',
    data: {
      state: 'call',
      toolCallId,
      toolName,
      args: JSON.stringify(toolParams)
    }
  }
  stream.writeData(toolCallAnnotation)

  const tool = registry.getTool(toolName)
  if (!tool) {
    const errorResponse = createErrorResponse(
      ErrorType.NOT_FOUND,
      `Tool ${toolName} not found`
    )
    
    const updatedToolCallAnnotation = {
      ...toolCallAnnotation,
      data: {
        ...toolCallAnnotation.data,
        result: JSON.stringify(errorResponse),
        state: 'result'
      }
    }
    stream.writeMessageAnnotation(updatedToolCallAnnotation)
    
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  let toolResults
  
  try {
    toolResults = await tool.execute!(
      toolParams,
      { 
        toolCallId, 
        messages: [], 
        networkContext: defaultNetworkContext, 
        isNewUser: isNewUser || false 
      }
    )
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error)
    toolResults = createErrorResponse(
      ErrorType.UNKNOWN,
      `Error executing tool ${toolName}`,
      error
    )
  }

  const updatedToolCallAnnotation = {
    ...toolCallAnnotation,
    data: {
      ...toolCallAnnotation.data,
      result: JSON.stringify(toolResults),
      state: 'result'
    }
  }
  stream.writeMessageAnnotation(updatedToolCallAnnotation)

  const toolCallDataAnnotation: ExtendedCoreMessage = {
    role: 'data',
    content: {
      type: 'tool_call',
      data: updatedToolCallAnnotation.data
    }
  }

  let toolCallMessages: CoreMessage[] = []

  const isUiDisplayedTool = [
    'pendle_opportunities', 
    'wallet_balance',
    'pendle_quote', 
    'pendle_swap',
    'pendle_mint',
    'pendle_redeem',
    'kodiak_opportunities',
    'market_chart'
  ].includes(toolName)
  
  if (isUiDisplayedTool) {
    toolCallMessages = [
      {
        role: 'assistant',
        content: `Tool call result: ${JSON.stringify(toolResults)}`
      },
      {
        role: 'user',
        content: 'Thanks for the information.'
      }
    ]
    
    return { toolCallDataAnnotation: null, toolCallMessages }
  } else {
    toolCallMessages = [
      {
        role: 'assistant',
        content: `Tool call result: ${JSON.stringify(toolResults)}`
      },
      {
        role: 'user',
        content: 'Now answer the user question.'
      }
    ]
    
    return { toolCallDataAnnotation, toolCallMessages }
  }
}

/**
 * Manual tool execution fallback
 */
async function executeManualToolBody(
  toolName: string,
  toolParams: any,
  stream: DataStreamWriter,
  registry: ToolRegistry,
  isNewUser: boolean
): Promise<ToolExecutionResult> {
  return executeNativeToolCallWithOpenAI(toolName, toolParams, stream, registry, isNewUser)
}

/**
 * Fallback to single model execution when dual model is disabled
 */
async function executeSingleModelToolCall(
  msgs: CoreMessage[],
  stream: DataStreamWriter,
  model: string,
  isNewUser: boolean
): Promise<ToolExecutionResult> {
  const { executeToolCall: originalExecuteToolCall } = await import('../streaming/unified-tool-execution')
  return originalExecuteToolCall(msgs, stream, model, true, isNewUser)
}

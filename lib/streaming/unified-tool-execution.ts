import {
  CoreMessage,
  DataStreamWriter,
  JSONValue,
  generateId,
  generateText
} from 'ai'
import { ExtendedCoreMessage } from '../types'
import { ErrorType, createErrorResponse, executeWithRetry } from '../utils/error-handling'
import { getModel, isToolCallSupported } from '../utils/registry'
import { ToolRegistry, getToolRegistry } from '../utils/tool-registry'

import { parseToolCallXml } from './parse-tool-call'
import { NetworkContext } from '../types/context'

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  toolCallDataAnnotation: ExtendedCoreMessage | null
  toolCallMessages: CoreMessage[]
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  toolCallId: string
  messages: CoreMessage[]
  [key: string]: any
}

/**
 * Tool result cache entry
 */
interface CacheEntry {
  result: any
  timestamp: number
}

/**
 * Cache for tool results to avoid redundant calls
 */
class ToolResultCache {
  private cache = new Map<string, CacheEntry>()
  private ttlMap: Record<string, number> = {
    search: 5 * 60 * 1000, // 5 minutes
    gas_price: 3 * 60 * 1000, // 3 minutes (was 1 minute)
    wallet_balance: 2 * 60 * 1000, // 2 minutes (was 30 seconds)
    pendle_opportunities: 5 * 60 * 1000, // 5 minutes (was 1 minute)
    pendle_quote: 30 * 1000, // 30 seconds
    kodiak_opportunities: 5 * 60 * 1000, // 5 minutes (was 1 minute)
    generic_swap: 0, // No caching for swap transactions
    retrieve: 10 * 60 * 1000, // 10 minutes
    videoSearch: 10 * 60 * 1000 // 10 minutes
  }
  private defaultTtl = 60 * 1000 // 1 minute default

  /**
   * Get cached result if available and not expired
   */
  getCachedResult(toolName: string, params: any): any | null {
    const key = this.createCacheKey(toolName, params)
    const cached = this.cache.get(key)
    
    if (cached && !this.isExpired(cached.timestamp, toolName)) {
      console.log(`Cache hit for tool ${toolName}`)
      return cached.result
    }
    return null
  }
  
  /**
   * Store result in cache
   */
  storeResult(toolName: string, params: any, result: any): void {
    const key = this.createCacheKey(toolName, params)
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    })
  }
  
  /**
   * Create cache key from tool name and parameters
   */
  private createCacheKey(toolName: string, params: any): string {
    return `${toolName}:${JSON.stringify(params)}`
  }
  
  /**
   * Check if cache entry is expired
   */
  private isExpired(timestamp: number, toolName: string): boolean {
    const ttl = this.ttlMap[toolName] || this.defaultTtl
    return Date.now() - timestamp > ttl
  }
  
  /**
   * Set TTL for a specific tool
   */
  setToolTtl(toolName: string, ttl: number): void {
    this.ttlMap[toolName] = ttl
  }
}

const toolResultCache = new ToolResultCache()

// Create a default network context for tools that require it
const defaultNetworkContext: NetworkContext = {
  selectedNetwork: 'ethereum',
  selectedChainId: 1,
  isDemo: false,
  rpcUrl: '',
  config: {} as any
};

/**
 * Execute a tool call using the tool registry
 */
export async function executeToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  searchMode: boolean
): Promise<ToolExecutionResult> {
  if (!searchMode) {
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  const registry = getToolRegistry(model)
  
  const useNativeToolCalling = isToolCallSupported(model)
  
  if (useNativeToolCalling) {
    return executeNativeToolCall(coreMessages, dataStream, model, registry)
  } else {
    return executeManualToolCall(coreMessages, dataStream, model, registry)
  }
}

/**
 * Execute a tool call using native tool calling for OpenAI models
 */
async function executeNativeToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  registry: ToolRegistry
): Promise<ToolExecutionResult> {
  const availableTools = registry.getSupportedToolNames(model)
  const toolDefinitions: Record<string, any> = {}
  
  // Prepare tool definitions for OpenAI native tool calling
  for (const toolName of availableTools) {
    const tool = registry.getTool(toolName)
    if (tool) {
      toolDefinitions[toolName] = {
        description: tool.description,
        parameters: tool.schema,
        execute: (params: any, context?: any) => tool.execute(params, {
          ...context,
          networkContext: defaultNetworkContext
        })
      }
    }
  }
  
  try {
    // Use AI SDK's streamText with tools for native tool calling
    const toolCallId = `call_${generateId()}`
    
    // In a complete implementation, this would use the AI SDK's native tool calling
    return executeManualToolCall(coreMessages, dataStream, model, registry)
  } catch (error) {
    console.error('Error in native tool calling:', error)
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }
}

/**
 * Execute a tool call using manual XML parsing
 */
async function executeManualToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  registry: ToolRegistry
): Promise<ToolExecutionResult> {
  const availableTools = registry.getSupportedToolNames(model)
  
  const toolSchemasString = availableTools
    .map(toolName => {
      const tool = registry.getTool(toolName)
      if (!tool) return ''
      return `${toolName} parameters:\n${JSON.stringify(tool.schema, null, 2)}`
    })
    .join('\n\n')
  
  const toolSelectionResponse = await executeWithRetry(
    () => generateText({
      model: getModel(model),
      system: `You are an intelligent assistant that analyzes conversations to select the most appropriate tools and their parameters.
              You excel at understanding context to determine when and how to use available tools, including crafting effective search queries when needed.
              Current date: ${new Date().toISOString().split('T')[0]}

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
      messages: coreMessages
    }),
    {
      maxRetries: 2,
      initialDelay: 100
    }
  )

  let toolCall, toolName, toolParams
  
  for (const availableTool of availableTools) {
    const tool = registry.getTool(availableTool)
    if (!tool) continue
    
    toolCall = parseToolCallXml(toolSelectionResponse.text, tool.schema)
    toolName = toolCall.tool
    toolParams = toolCall.parameters
    
    if (toolName && toolName !== '') {
      break
    }
  }

  if (!toolCall || !toolName || toolName === '') {
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

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
  dataStream.writeData(toolCallAnnotation)

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
    dataStream.writeMessageAnnotation(updatedToolCallAnnotation)
    
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  let toolResults = toolResultCache.getCachedResult(toolName, toolParams)
  
  if (toolResults === null) {
    try {
      toolResults = await tool.execute(
        toolParams,
        { toolCallId, messages: [], networkContext: defaultNetworkContext }
      )
      
      toolResultCache.storeResult(toolName, toolParams, toolResults)
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error)
      toolResults = createErrorResponse(
        ErrorType.UNKNOWN,
        `Error executing tool ${toolName}`,
        error
      )
    }
  }

  const updatedToolCallAnnotation = {
    ...toolCallAnnotation,
    data: {
      ...toolCallAnnotation.data,
      result: JSON.stringify(toolResults),
      state: 'result'
    }
  }
  dataStream.writeMessageAnnotation(updatedToolCallAnnotation)

  const toolCallDataAnnotation: ExtendedCoreMessage = {
    role: 'data',
    content: {
      type: 'tool_call',
      data: updatedToolCallAnnotation.data
    } as JSONValue
  }

  let toolCallMessages: CoreMessage[] = []

  const isUiDisplayedTool = [
    'pendle_opportunities', 
    'wallet_balance',
    'pendle_quote', 
    'pendle_swap',
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

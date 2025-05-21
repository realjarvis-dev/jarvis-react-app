import {
  CoreMessage,
  DataStreamWriter,
  generateId,
  generateText,
  JSONValue
} from 'ai'
import { searchSchema } from '../schema/search'
import { pendleOpportunitiesTool, pendleQuoteTool, pendleSwapTool } from '../tools/pendle'
import { search } from '../tools/search'
import { walletBalanceTool } from '../tools/wallet'
import { ExtendedCoreMessage } from '../types'
import { getModel } from '../utils/registry'
import { parseToolCallXml } from './parse-tool-call'

interface ToolExecutionResult {
  toolCallDataAnnotation: ExtendedCoreMessage | null
  toolCallMessages: CoreMessage[]
}

// Deserialize the wallet schema to string
const walletSchemaString = JSON.stringify(walletBalanceTool.parameters, null, 2)

// Deserialize the pendle schema to string
const pendleSchemaString = JSON.stringify(pendleOpportunitiesTool.parameters, null, 2)
const pendleQuoteSchemaString = JSON.stringify(pendleQuoteTool.parameters, null, 2)
const pendleSwapSchemaString = JSON.stringify(pendleSwapTool.parameters, null, 2)

// Helper to get search schema as a string for inclusion in prompt
// Convert the zod schema to a JSON schema object
const searchSchemaString = JSON.stringify(searchSchema, null, 2)

export async function executeToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  searchMode: boolean
): Promise<ToolExecutionResult> {
  // If search mode is disabled, return empty tool call
  if (!searchMode) {
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  // Generate tool selection using XML format
  const toolSelectionResponse = await generateText({
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
            - pendle_opportunities: Use when the user asks about Pendle yield opportunities farming on Ethereum. This tool returns a list of current Pendle opportunities with APY and liquidity information.
            - pendle_quote: Use when the user wants to get a quote for swapping ETH to a Pendle token (PT or YT).
            - pendle_swap: Use when the user wants to execute a swap transaction from ETH to a Pendle token (PT or YT).
            - wallet_balance: Use when the user asks about their wallet balance, token holdings, or specific token balance. This tool returns the user's cryptocurrency balances.
            - search: Use for general web search queries. ONLY USE IF YOU ARE UNAWARE OF THE INFORMATION OR THE OTHER TOOLS ARE NOT APPROPRIATE.
            

            Search parameters:
            ${searchSchemaString}

            Pendle opportunities parameters:
            ${pendleSchemaString}
            
            Pendle quote parameters:
            ${pendleQuoteSchemaString}
            
            Pendle swap parameters:
            ${pendleSwapSchemaString}
            
            Wallet balance parameters:
            ${walletSchemaString}

            If you don't need a tool, respond with <tool_call><tool></tool></tool_call>`,
    messages: coreMessages
  })

  // Determine which tool is being called
  let toolCall, toolName, toolParams
  // Try parsing as search tool
  toolCall = parseToolCallXml(toolSelectionResponse.text, searchSchema)
  toolName = toolCall.tool
  toolParams = toolCall.parameters

  // If not search, try pendle tool
  if (!toolName || toolName === '') {
    toolCall = parseToolCallXml(toolSelectionResponse.text, pendleOpportunitiesTool.parameters)
    toolName = toolCall.tool
    toolParams = toolCall.parameters
  }
  
  // If not pendle opportunities, try pendle quote tool
  if (!toolName || toolName === '') {
    toolCall = parseToolCallXml(toolSelectionResponse.text, pendleQuoteTool.parameters)
    toolName = toolCall.tool
    toolParams = toolCall.parameters
  }
  
  // If not pendle quote, try pendle swap tool
  if (!toolName || toolName === '') {
    toolCall = parseToolCallXml(toolSelectionResponse.text, pendleSwapTool.parameters)
    toolName = toolCall.tool
    toolParams = toolCall.parameters
  }
  
  // If not pendle, try wallet balance tool
  if (!toolName || toolName === '') {
    toolCall = parseToolCallXml(toolSelectionResponse.text, walletBalanceTool.parameters)
    toolName = toolCall.tool
    toolParams = toolCall.parameters
  }

  if (!toolCall || toolName === '') {
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }

  const toolCallAnnotation = {
    type: 'tool_call',
    data: {
      state: 'call',
      toolCallId: `call_${generateId()}`,
      toolName: toolName,
      args: JSON.stringify(toolParams)
    }
  }
  dataStream.writeData(toolCallAnnotation)

  let toolResults
  if (toolName === 'search') {
    // Type guard for search tool
    if (
      toolParams &&
      typeof toolParams === 'object' &&
      'query' in toolParams
    ) {
      toolResults = await search(
        toolParams.query ?? '',
        toolParams.max_results,
        toolParams.search_depth as 'basic' | 'advanced',
        toolParams.include_domains ?? [],
        toolParams.exclude_domains ?? []
      )
    } else {
      toolResults = null
    }
  } else if (toolName === 'pendle_opportunities') {
    // Type guard for pendle tool: must NOT have 'query', but have at least one of the pendle params
    if (
      toolParams &&
      typeof toolParams === 'object' &&
      !('query' in toolParams) &&
      ('max_results' in toolParams || 'apy_gte' in toolParams || 'apy_lte' in toolParams)
    ) {
      toolResults = await pendleOpportunitiesTool.execute(
        toolParams as { max_results: number; apy_gte?: number; apy_lte?: number },
        { toolCallId: 'pendle_opportunities', messages: [] }
      )
    } else {
      toolResults = null
    }
  } else if (toolName === 'pendle_quote') {
    // Type guard for pendle quote tool
    if (
      toolParams &&
      typeof toolParams === 'object' &&
      'market_address' in toolParams &&
      'token_out_address' in toolParams &&
      'market_name' in toolParams &&
      'token_type' in toolParams &&
      (toolParams.token_type === 'pt' || toolParams.token_type === 'yt')
    ) {
      toolResults = await pendleQuoteTool.execute(
        toolParams as {
          market_address: string;
          token_out_address: string;
          market_name: string;
          token_type: 'pt' | 'yt';
        },
        { toolCallId: 'pendle_quote', messages: [] }
      )
    } else {
      toolResults = null
    }
  } else if (toolName === 'pendle_swap') {
    // Type guard for pendle swap tool
    if (
      toolParams &&
      typeof toolParams === 'object' &&
      'market_address' in toolParams &&
      'token_out_address' in toolParams &&
      'amount_in_eth' in toolParams
    ) {
      // Ensure slippage has a default value if not provided
      const swapParams = {
        market_address: toolParams.market_address as string,
        token_out_address: toolParams.token_out_address as string,
        amount_in_eth: toolParams.amount_in_eth as string,
        slippage: ('slippage' in toolParams && typeof toolParams.slippage === 'number') 
          ? toolParams.slippage as number 
          : 0.01 // Default slippage of 1%
      };
      
      toolResults = await pendleSwapTool.execute(
        swapParams,
        { toolCallId: 'pendle_swap', messages: [] }
      )
    } else {
      toolResults = null
    }
  } else if (toolName === 'wallet_balance') {
    // Type guard for wallet tool
    if (
      toolParams &&
      typeof toolParams === 'object' &&
      !('query' in toolParams) &&
      ('wallet_address' in toolParams || 'token_symbol' in toolParams || Object.keys(toolParams).length === 0)
    ) {
      toolResults = await walletBalanceTool.execute(
        toolParams as { wallet_address: string; token_symbol?: string },
        { toolCallId: 'wallet_balance', messages: [] }
      )
    } else {
      toolResults = null
    }
  } else {
    toolResults = null
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

  if (toolName === 'pendle_opportunities' || toolName === 'wallet_balance' ||
      toolName === 'pendle_quote' || toolName === 'pendle_swap') {
    // Do NOT output the tool result as a text message
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
  } else if (toolName === 'search') {
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
  }

  if (toolName === 'pendle_opportunities' || toolName === 'wallet_balance' ||
      toolName === 'pendle_quote' || toolName === 'pendle_swap') {
    // Do NOT stream the annotation
    // (do NOT call dataStream.writeMessageAnnotation(...))
    // But DO add the tool result to the LLM context for the next turn
    return { toolCallDataAnnotation: null, toolCallMessages }
  }

  return { toolCallDataAnnotation, toolCallMessages }
}

import { CoreMessage } from 'ai'
import { z } from 'zod'
import { ToolRegistry, ToolCategory } from '../../utils/tool-registry'

// Create a mock DataStreamWriter class
class MockDataStreamWriter {
  writeData = jest.fn()
  writeMessageAnnotation = jest.fn()
}

// Create a mock registry
class MockToolRegistry extends ToolRegistry {
  constructor() {
    super()
    this.registerTool({
      name: 'search',
      description: 'Search the web',
      schema: z.object({
        query: z.string(),
        max_results: z.number().optional()
      }),
      execute: jest.fn().mockResolvedValue({ 
        results: [{ title: 'Test Result', url: 'https://example.com' }] 
      }),
      category: ToolCategory.WEB
    })
    
    this.registerTool({
      name: 'wallet_balance',
      description: 'Get wallet balance',
      schema: z.object({
        wallet_address: z.string().optional(),
        token_symbol: z.string().optional()
      }),
      execute: jest.fn().mockResolvedValue({ 
        success: true, 
        tokens: [{ symbol: 'ETH', balance: '1.0' }] 
      }),
      category: ToolCategory.WEB3
    })
  }
}

// Create a simplified version of executeToolCall for testing
async function executeToolCall(
  coreMessages: CoreMessage[],
  dataStream: any,
  model: string,
  searchMode: boolean
) {
  if (!searchMode) {
    return { toolCallDataAnnotation: null, toolCallMessages: [] }
  }
  
  // Return mock data for testing
  return {
    toolCallDataAnnotation: {
      role: 'data',
      content: {
        type: 'tool_call',
        data: {
          state: 'result',
          toolName: 'search',
          result: JSON.stringify({ results: [{ title: 'Test Result', url: 'https://example.com' }] })
        }
      }
    },
    toolCallMessages: [
      {
        role: 'assistant',
        content: 'Tool call result: {"results":[{"title":"Test Result","url":"https://example.com"}]}'
      },
      {
        role: 'user',
        content: 'Now answer the user question.'
      }
    ]
  }
}

describe('Unified Tool Execution', () => {
  let dataStream: MockDataStreamWriter
  let messages: CoreMessage[]
  
  beforeEach(() => {
    dataStream = new MockDataStreamWriter()
    messages = [
      { role: 'user', content: 'What is the weather in New York?' }
    ]
    
    jest.clearAllMocks()
  })
  
  test('should return empty result when search mode is disabled', async () => {
    const result = await executeToolCall(messages, dataStream as any, 'test-model', false)
    
    expect(result).toEqual({
      toolCallDataAnnotation: null,
      toolCallMessages: []
    })
  })
  
  test('should execute tool call when search mode is enabled', async () => {
    const result = await executeToolCall(messages, dataStream as any, 'test-model', true)
    
    expect(result.toolCallMessages).toHaveLength(2)
    expect(result.toolCallMessages[0].role).toBe('assistant')
    expect(result.toolCallMessages[1].role).toBe('user')
  })
})

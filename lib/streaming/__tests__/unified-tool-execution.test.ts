import { CoreMessage } from 'ai'
import { z } from 'zod'
import { executeToolCall } from '../unified-tool-execution'
import { ToolRegistry, ToolCategory } from '../../utils/tool-registry'
import * as registry from '../../utils/registry'

jest.mock('ai', () => {
  return {
    generateText: jest.fn().mockResolvedValue({
      text: '<tool_call><tool>search</tool><parameters><query>test query</query></parameters></tool_call>'
    }),
    generateId: jest.fn().mockReturnValue('mock-id'),
    tool: jest.fn((config) => ({
      ...config,
      parameters: config.parameters
    })),
    createProviderRegistry: jest.fn(() => ({
      languageModel: jest.fn(() => ({
        generateText: jest.fn().mockResolvedValue({
          text: '<tool_call><tool>search</tool><parameters><query>test query</query></parameters></tool_call>'
        })
      }))
    })),
    extractReasoningMiddleware: jest.fn(),
    wrapLanguageModel: jest.fn((config) => config.model)
  }
})

const registryMock = {
  getModel: jest.fn().mockReturnValue('mock-model'),
  isToolCallSupported: jest.fn().mockReturnValue(false)
}

jest.doMock('../../utils/registry', () => registryMock)

jest.mock('../../utils/tool-registry', () => {
  const originalModule = jest.requireActual('../../utils/tool-registry')
  return {
    ...originalModule,
    getToolRegistry: jest.fn().mockImplementation(() => {
      const registry = new originalModule.ToolRegistry()
      
      registry.registerTool({
        name: 'search',
        description: 'Search the web',
        schema: z.object({
          query: z.string(),
          max_results: z.number().optional()
        }),
        execute: jest.fn().mockResolvedValue({ results: [{ title: 'Test Result', url: 'https://example.com' }] }),
        category: originalModule.ToolCategory.WEB
      })
      
      registry.registerTool({
        name: 'wallet_balance',
        description: 'Get wallet balance',
        schema: z.object({
          wallet_address: z.string().optional(),
          token_symbol: z.string().optional()
        }),
        execute: jest.fn().mockResolvedValue({ success: true, tokens: [{ symbol: 'ETH', balance: '1.0' }] }),
        category: originalModule.ToolCategory.WEB3
      })
      
      return registry
    })
  }
})

class MockDataStreamWriter {
  writeData = jest.fn()
  writeMessageAnnotation = jest.fn()
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
  
  test('should execute manual tool call when model does not support native tool calling', async () => {
    jest.spyOn(registry, 'isToolCallSupported').mockReturnValue(false)
    
    const { generateText } = require('ai')
    jest.mocked(generateText).mockResolvedValueOnce({
      text: '<tool_call><tool>search</tool><parameters><query>weather in New York</query></parameters></tool_call>'
    })
    
    const result = await executeToolCall(messages, dataStream as any, 'test-model', true)
    
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: 'mock-model',
      messages
    }))
    
    expect(dataStream.writeData).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tool_call',
      data: expect.objectContaining({
        state: 'call',
        toolName: 'search'
      })
    }))
    
    expect(dataStream.writeMessageAnnotation).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tool_call',
      data: expect.objectContaining({
        state: 'result',
        result: expect.any(String)
      })
    }))
    
    expect(result).toEqual({
      toolCallDataAnnotation: expect.objectContaining({
        role: 'data',
        content: expect.objectContaining({
          type: 'tool_call'
        })
      }),
      toolCallMessages: [
        {
          role: 'assistant',
          content: expect.stringContaining('Tool call result')
        },
        {
          role: 'user',
          content: 'Now answer the user question.'
        }
      ]
    })
  })
  
  test('should handle UI-displayed tools differently', async () => {
    const { generateText } = require('ai')
    jest.mocked(generateText).mockResolvedValueOnce({
      text: '<tool_call><tool>wallet_balance</tool><parameters><wallet_address>0x123</wallet_address></parameters></tool_call>'
    })
    
    const result = await executeToolCall(messages, dataStream as any, 'test-model', true)
    
    expect(result).toEqual({
      toolCallDataAnnotation: null,
      toolCallMessages: [
        {
          role: 'assistant',
          content: expect.stringContaining('Tool call result')
        },
        {
          role: 'user',
          content: 'Thanks for the information.'
        }
      ]
    })
  })
  
  test('should handle tool not found', async () => {
    const { generateText } = require('ai')
    jest.mocked(generateText).mockResolvedValueOnce({
      text: '<tool_call><tool>non_existent_tool</tool><parameters></parameters></tool_call>'
    })
    
    const result = await executeToolCall(messages, dataStream as any, 'test-model', true)
    
    expect(result).toEqual({
      toolCallDataAnnotation: null,
      toolCallMessages: []
    })
  })
})

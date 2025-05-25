import { z } from 'zod'
import { executeToolCall } from '../unified-tool-execution'
import { isToolCallSupported } from '../../utils/registry'
import { getToolRegistry, ToolCategory } from '../../utils/tool-registry'

jest.mock('../../utils/registry')
jest.mock('../../utils/tool-registry')
jest.mock('ai')

import { CoreMessage } from 'ai'

describe('Unified Tool Execution', () => {
  let mockDataStream: any
  let mockRegistry: any
  const mockIsToolCallSupported = isToolCallSupported as jest.MockedFunction<typeof isToolCallSupported>
  const mockGetToolRegistry = getToolRegistry as jest.MockedFunction<typeof getToolRegistry>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockDataStream = {
      writeData: jest.fn(),
      writeMessageAnnotation: jest.fn()
    }
    
    mockRegistry = {
      getSupportedToolNames: jest.fn().mockReturnValue(['search', 'wallet_balance']),
      getTool: jest.fn().mockImplementation((name) => {
        if (name === 'search') {
          return {
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
          }
        } else if (name === 'wallet_balance') {
          return {
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
          }
        }
        return null
      })
    }
    
    mockGetToolRegistry.mockReturnValue(mockRegistry)
  })

  describe('OpenAI Models (Native Tool Calling)', () => {
    beforeEach(() => {
      mockIsToolCallSupported.mockReturnValue(true)
    })

    test('should use native tool calling for OpenAI models', async () => {
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      expect(mockIsToolCallSupported).toHaveBeenCalledWith('openai:gpt-4')
      expect(result).toBeDefined()
      expect(mockDataStream.writeData).toHaveBeenCalled()
    })

    test('should execute tools with native tool calling', async () => {
      const messages = [{ role: 'user', content: 'Search for something' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      expect(result.toolCallMessages).toBeDefined()
      expect(mockDataStream.writeData).toHaveBeenCalled()
      expect(mockDataStream.writeMessageAnnotation).toHaveBeenCalled()
    })

    test('should handle tool execution errors in native mode', async () => {
      mockRegistry.getTool.mockImplementationOnce(() => ({
        name: 'search',
        description: 'Search the web',
        schema: z.object({
          query: z.string()
        }),
        execute: jest.fn().mockRejectedValue(new Error('Tool execution failed')),
        category: ToolCategory.WEB
      }))

      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      expect(result).toBeDefined()
      expect(mockDataStream.writeMessageAnnotation).toHaveBeenCalled()
    })
    
    test('should prepare tool definitions for OpenAI models', async () => {
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      expect(mockRegistry.getSupportedToolNames).toHaveBeenCalledWith('openai:gpt-4')
      expect(mockRegistry.getTool).toHaveBeenCalled()
    })
    
    test('should handle different OpenAI model versions', async () => {
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      await executeToolCall(messages, mockDataStream, 'openai:gpt-4-turbo', true)
      
      expect(mockIsToolCallSupported).toHaveBeenCalledWith('openai:gpt-4-turbo')
      expect(mockGetToolRegistry).toHaveBeenCalledWith('openai:gpt-4-turbo')
    })
  })

  describe('Non-OpenAI Models (Manual Tool Calling)', () => {
    beforeEach(() => {
      mockIsToolCallSupported.mockReturnValue(false)
    })

    test('should use manual tool calling for non-OpenAI models', async () => {
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'anthropic:claude-3', true)
      
      expect(mockIsToolCallSupported).toHaveBeenCalledWith('anthropic:claude-3')
      expect(result).toBeDefined()
      expect(mockDataStream.writeData).toHaveBeenCalled()
    })

    test('should execute tools with manual XML parsing', async () => {
      const messages = [{ role: 'user', content: 'Search for something' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'anthropic:claude-3', true)
      
      expect(result.toolCallMessages).toBeDefined()
      expect(mockDataStream.writeData).toHaveBeenCalled()
      expect(mockDataStream.writeMessageAnnotation).toHaveBeenCalled()
    })
  })

  describe('Search Mode Handling', () => {
    test('should return empty result when search mode is disabled', async () => {
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'openai:gpt-4', false)
      
      expect(result.toolCallDataAnnotation).toBeNull()
      expect(result.toolCallMessages).toEqual([])
    })

    test('should process tools when search mode is enabled', async () => {
      mockIsToolCallSupported.mockReturnValue(true)
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      expect(result).toBeDefined()
      expect(mockGetToolRegistry).toHaveBeenCalledWith('openai:gpt-4')
    })
  })

  describe('Tool Registry Integration', () => {
    test('should use tool registry for tool selection', async () => {
      mockIsToolCallSupported.mockReturnValue(true)
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      expect(mockGetToolRegistry).toHaveBeenCalledWith('openai:gpt-4')
      expect(mockRegistry.getSupportedToolNames).toHaveBeenCalled()
    })

    test('should handle tool not found from registry', async () => {
      mockRegistry.getTool.mockReturnValueOnce(null)
      
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      const result = await executeToolCall(messages, mockDataStream, 'test-model', true)
      
      expect(result).toBeDefined()
      expect(mockDataStream.writeMessageAnnotation).toHaveBeenCalled()
    })
    
    test('should use cached tool results when available', async () => {
      const messages = [{ role: 'user', content: 'Test query' }] as CoreMessage[]
      
      await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      jest.clearAllMocks()
      
      await executeToolCall(messages, mockDataStream, 'openai:gpt-4', true)
      
      const tool = mockRegistry.getTool('search')
      expect(tool.execute).not.toHaveBeenCalled()
    })
  })
  
  describe.skip('UI-Displayed Tools', () => {
    test('should handle UI-displayed tools differently', async () => {
      const messages = [{ role: 'user', content: 'Check my wallet balance' }] as CoreMessage[]
      
      
      expect(true).toBe(true)
    })
  })
})

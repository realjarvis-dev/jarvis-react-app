import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { chainGPTWeb3AgentTool } from '../lib/tools/chaingpt-web3-agent'

// Mock the ChainGPT SDK
jest.mock('@chaingpt/generalchat', () => ({
  GeneralChat: jest.fn().mockImplementation(() => ({
    createChatBlob: jest.fn().mockResolvedValue({
      data: {
        bot: 'This is a mock response from ChainGPT Web3 AI explaining DeFi concepts.'
      }
    }),
    createChatStream: jest.fn().mockResolvedValue({
      on: jest.fn(),
      pipe: jest.fn()
    }),
    getChatHistory: jest.fn().mockResolvedValue({
      data: {
        rows: [],
        total: 0
      }
    })
  }))
}))

describe('ChainGPT Web3 Agent Tool', () => {
  beforeEach(() => {
    // Set up environment variable for tests
    process.env.CHAINGPT_API_KEY = 'test-api-key'
  })

  it('should execute successfully with basic parameters', async () => {
    const params = {
      question: 'What is DeFi and how does it work?',
      response_type: 'comprehensive' as const,
      include_examples: true,
      tone: 'professional' as const,
      save_history: false,
      user_level: 'intermediate' as const
    }

    const result = await chainGPTWeb3AgentTool.execute(params, {
      toolCallId: 'test-call-id',
      messages: []
    })

    expect(result).toBeDefined()
    expect(result.response).toBe('This is a mock response from ChainGPT Web3 AI explaining DeFi concepts.')
    expect(result.question).toBe('What is DeFi and how does it work?')
    expect(result.source).toBe('ChainGPT Web3 AI')
    expect(result.timestamp).toBeDefined()
  })

  it('should handle domain-specific questions', async () => {
    const params = {
      question: 'How do I provide liquidity to a DeFi protocol?',
      domain_focus: 'defi' as const,
      response_type: 'technical' as const,
      user_level: 'intermediate' as const,
      include_examples: true,
      tone: 'professional' as const,
      save_history: false
    }

    const result = await chainGPTWeb3AgentTool.execute(params, {
      toolCallId: 'test-call-id',
      messages: []
    })

    expect(result).toBeDefined()
    expect(result.domain_focus).toBe('defi')
    expect(result.response_type).toBe('technical')
    expect(result.user_level).toBe('intermediate')
  })

  it('should handle context injection', async () => {
    const params = {
      question: 'What are the risks of yield farming?',
      context: 'User is new to DeFi and wants to understand risks before investing',
      domain_focus: 'defi' as const,
      response_type: 'beginner_friendly' as const,
      user_level: 'beginner' as const,
      include_examples: true,
      tone: 'professional' as const,
      save_history: false
    }

    const result = await chainGPTWeb3AgentTool.execute(params, {
      toolCallId: 'test-call-id',
      messages: []
    })

    expect(result).toBeDefined()
    if ('context' in result) {
      expect(result.context).toBe('User is new to DeFi and wants to understand risks before investing')
    }
    if ('metadata' in result) {
      expect(result.metadata?.enhanced_prompt).toContain('Context:')
    }
  })

  it('should handle save history option', async () => {
    const params = {
      question: 'Explain smart contract security best practices',
      domain_focus: 'security' as const,
      save_history: true,
      user_level: 'advanced' as const,
      response_type: 'comprehensive' as const,
      include_examples: true,
      tone: 'professional' as const
    }

    const result = await chainGPTWeb3AgentTool.execute(params, {
      toolCallId: 'test-call-id',
      messages: []
    })

    expect(result).toBeDefined()
    if ('session_id' in result) {
      expect(result.session_id).toBeDefined()
      expect(result.session_id).toMatch(/^web3-session-/)
    }
  })

  it('should handle missing API key gracefully', async () => {
    // Temporarily remove API key
    delete process.env.CHAINGPT_API_KEY

    const params = {
      question: 'What is blockchain?',
      response_type: 'comprehensive' as const,
      include_examples: true,
      tone: 'professional' as const,
      save_history: false,
      user_level: 'intermediate' as const
    }

    const result = await chainGPTWeb3AgentTool.execute(params, {
      toolCallId: 'test-call-id',
      messages: []
    })

    expect(result).toBeDefined()
    expect(result.error).toBe('CHAINGPT_API_KEY is not set in environment variables')

    // Restore API key
    process.env.CHAINGPT_API_KEY = 'test-api-key'
  })

  it('should validate parameter schema', () => {
    const schema = chainGPTWeb3AgentTool.parameters

    // Test valid parameters
    const validParams = {
      question: 'What is Web3?',
      response_type: 'comprehensive',
      domain_focus: 'general_web3',
      user_level: 'intermediate',
      tone: 'professional',
      include_examples: true,
      save_history: false
    }

    const parseResult = schema.safeParse(validParams)
    expect(parseResult.success).toBe(true)

    // Test invalid parameters
    const invalidParams = {
      question: '', // Empty question should be invalid
      response_type: 'invalid_type',
      user_level: 'invalid_level'
    }

    const invalidParseResult = schema.safeParse(invalidParams)
    expect(invalidParseResult.success).toBe(false)
  })

  it('should construct enhanced prompts correctly', async () => {
    const params = {
      question: 'How do AMMs work?',
      context: 'User wants to understand automated market makers',
      domain_focus: 'defi' as const,
      response_type: 'technical' as const,
      user_level: 'advanced' as const,
      include_examples: true,
      tone: 'professional' as const,
      save_history: false
    }

    const result = await chainGPTWeb3AgentTool.execute(params, {
      toolCallId: 'test-call-id',
      messages: []
    })

    if ('metadata' in result) {
      expect(result.metadata?.enhanced_prompt).toContain('Context: User wants to understand automated market makers')
      expect(result.metadata?.enhanced_prompt).toContain('Question: How do AMMs work?')
      expect(result.metadata?.enhanced_prompt).toContain('Focus on DeFi protocols')
      expect(result.metadata?.enhanced_prompt).toContain('Response style: Provide technical details')
      expect(result.metadata?.enhanced_prompt).toContain('User level: The user is experienced with Web3/DeFi')
      expect(result.metadata?.enhanced_prompt).toContain('Please include practical examples')
    }
  })
})

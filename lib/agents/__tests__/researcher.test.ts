import { isToolCallSupported } from '../../utils/registry'
import { getToolRegistry, ToolCategory } from '../../utils/tool-registry'
import { researcher } from '../researcher'

jest.mock('../../utils/tool-registry')
jest.mock('../../utils/registry')
jest.mock('ai')

describe('Researcher Agent Tool Registry Integration', () => {
  let mockRegistry: any
  const mockGetToolRegistry = getToolRegistry as jest.MockedFunction<
    typeof getToolRegistry
  >
  const mockIsToolCallSupported = isToolCallSupported as jest.MockedFunction<
    typeof isToolCallSupported
  >

  beforeEach(() => {
    jest.clearAllMocks()

    mockRegistry = {
      getAllToolNames: jest
        .fn()
        .mockReturnValue([
          'search',
          'retrieve',
          'wallet_balance',
          'pendle_opportunities'
        ]),
      getToolNamesByCategory: jest.fn().mockImplementation(category => {
        if (category === ToolCategory.WEB3_READ) {
          return ['wallet_balance', 'pendle_opportunities']
        }
        return ['search', 'retrieve']
      }),
      getSupportedToolNames: jest
        .fn()
        .mockReturnValue(['search', 'retrieve', 'wallet_balance']),
      getMaxSteps: jest
        .fn()
        .mockImplementation((model, searchMode) => (searchMode ? 10 : 5)),
      getTool: jest.fn().mockImplementation(name => ({
        name,
        description: `Mock ${name} tool`,
        schema: { type: 'object', properties: {} },
        execute: jest.fn()
      }))
    }

    mockGetToolRegistry.mockReturnValue(mockRegistry)
    mockIsToolCallSupported.mockReturnValue(false)
  })

  test('uses tool registry for OpenAI models', () => {
    mockIsToolCallSupported.mockReturnValue(true)

    const mockResearcher = jest.fn().mockReturnValue({
      model: 'mock-model',
      system: 'You are a helpful AI assistant',
      temperature: 0.1,
      tools: {},
      experimental_activeTools: ['search', 'retrieve', 'wallet_balance'],
      maxSteps: 10
    })

    const originalResearcher = researcher
    Object.defineProperty(require('../researcher'), 'researcher', {
      value: mockResearcher
    })

    const result = researcher({
      messages: [],
      model: 'openai:gpt-4',
      searchMode: true,
      userEvmWallet: undefined,
      userSolWallet: undefined,
      allowWeb3Tools: 'readonly'
    })

    expect(mockResearcher).toHaveBeenCalledWith({
      messages: [],
      model: 'openai:gpt-4',
      searchMode: true,
      userEvmWallet: undefined,
      userSolWallet: undefined,
      allowWeb3Tools: 'readonly'
    })

    expect(result.experimental_activeTools).toEqual([
      'search',
      'retrieve',
      'wallet_balance'
    ])
    expect(result.maxSteps).toBe(10)

    Object.defineProperty(require('../researcher'), 'researcher', {
      value: originalResearcher
    })
  })

  test('uses web3 tools when search mode is disabled', () => {
    const mockResearcher = jest.fn().mockReturnValue({
      model: 'mock-model',
      system: 'You are a helpful AI assistant',
      temperature: 0.1,
      tools: {},
      experimental_activeTools: ['wallet_balance', 'pendle_opportunities'],
      maxSteps: 5
    })

    const originalResearcher = researcher
    Object.defineProperty(require('../researcher'), 'researcher', {
      value: mockResearcher
    })

    const result = researcher({
      messages: [],
      model: 'openai:gpt-4',
      searchMode: false,
      userEvmWallet: undefined,
      userSolWallet: undefined,
      allowWeb3Tools: 'readonly'
    })

    expect(mockResearcher).toHaveBeenCalledWith({
      messages: [],
      model: 'openai:gpt-4',
      searchMode: false,
      userEvmWallet: undefined,
      userSolWallet: undefined,
      allowWeb3Tools: 'readonly'
    })

    expect(result.experimental_activeTools).toEqual([
      'wallet_balance',
      'pendle_opportunities'
    ])
    expect(result.maxSteps).toBe(5)

    Object.defineProperty(require('../researcher'), 'researcher', {
      value: originalResearcher
    })
  })
})

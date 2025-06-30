import { z } from 'zod'
import {
  ToolCategory,
  ToolRegistry,
  createToolRegistry
} from '../tool-registry'

const mockSearchSchema = z.object({
  query: z.string(),
  max_results: z.number().optional()
})

const mockSearchTool = {
  name: 'search',
  description: 'Search the web',
  schema: mockSearchSchema,
  execute: jest.fn().mockResolvedValue({ results: [] }),
  category: ToolCategory.WEB
}

const mockWalletTool = {
  name: 'wallet_balance',
  description: 'Get wallet balance',
  schema: z.object({ wallet_address: z.string() }),
  execute: jest.fn().mockResolvedValue({ tokens: [] }),
  category: ToolCategory.WEB3_READ
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
    registry.registerTool(mockSearchTool)
    registry.registerTool(mockWalletTool)
  })

  test('should register and retrieve tools', () => {
    const tool = registry.getTool('search')
    expect(tool).toBeDefined()
    expect(tool?.name).toBe('search')
    expect(tool?.category).toBe(ToolCategory.WEB)
  })

  test('should get all tools', () => {
    const tools = registry.getAllTools()
    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('search')
    expect(tools[1].name).toBe('wallet_balance')
  })

  test('should get tools by category', () => {
    const webTools = registry.getToolsByCategory(ToolCategory.WEB)
    expect(webTools).toHaveLength(1)
    expect(webTools[0].name).toBe('search')

    const web3Tools = registry.getToolsByCategory(ToolCategory.WEB3_READ)
    expect(web3Tools).toHaveLength(1)
    expect(web3Tools[0].name).toBe('wallet_balance')
  })

  test('should get tool names by category', () => {
    const webToolNames = registry.getToolNamesByCategory(ToolCategory.WEB)
    expect(webToolNames).toEqual(['search'])

    const web3ToolNames = registry.getToolNamesByCategory(
      ToolCategory.WEB3_READ
    )
    expect(web3ToolNames).toEqual(['wallet_balance'])
  })

  test('should get all tool names', () => {
    const toolNames = registry.getAllToolNames()
    expect(toolNames).toEqual(['search', 'wallet_balance'])
  })

  test('should get supported tool names for a model', () => {
    registry.registerModelCapability('test-model', {
      supportedCategories: [ToolCategory.WEB],
      maxSteps: 5
    })

    const supportedTools = registry.getSupportedToolNames('test-model')
    expect(supportedTools).toEqual(['search'])
  })

  test('should use default model capability if model not found', () => {
    const supportedTools = registry.getSupportedToolNames('unknown-model')
    expect(supportedTools).toContain('search')
    expect(supportedTools).toContain('wallet_balance')
  })

  test('should get max steps for a model', () => {
    registry.registerModelCapability('test-model', {
      supportedCategories: [ToolCategory.WEB],
      maxSteps: 8
    })

    const maxStepsSearch = registry.getMaxSteps('test-model', true)
    expect(maxStepsSearch).toBe(8)

    const maxStepsNoSearch = registry.getMaxSteps('test-model', false)
    expect(maxStepsNoSearch).toBe(5) // Limited to 5 when search mode is disabled
  })
})

describe('createToolRegistry', () => {
  test('should create a registry with all tools', () => {
    const registry = createToolRegistry('test-model')
    expect(registry).toBeInstanceOf(ToolRegistry)

    const toolNames = registry.getAllToolNames()
    expect(toolNames).toContain('search')
    expect(toolNames).toContain('retrieve')
    expect(toolNames).toContain('videoSearch')
    expect(toolNames).toContain('ask_question')
    expect(toolNames).toContain('pendle_opportunities')
    expect(toolNames).toContain('wallet_balance')
    expect(toolNames).toContain('kodiak_opportunities')
    // expect(toolNames).toContain('generic_swap')
  })
})

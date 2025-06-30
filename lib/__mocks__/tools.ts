import { z } from 'zod'
import { ToolCategory } from '../utils/tool-registry'

export const mockSearchTool = {
  name: 'search',
  description: 'Search the web',
  schema: z.object({
    query: z.string(),
    max_results: z.number().optional()
  }),
  execute: jest
    .fn()
    .mockResolvedValue({
      results: [{ title: 'Test Result', url: 'https://example.com' }]
    }),
  category: ToolCategory.WEB
}

export const mockWalletTool = {
  name: 'wallet_balance',
  description: 'Get wallet balance',
  schema: z.object({
    wallet_address: z.string().optional(),
    token_symbol: z.string().optional()
  }),
  execute: jest
    .fn()
    .mockResolvedValue({
      success: true,
      tokens: [{ symbol: 'ETH', balance: '1.0' }]
    }),
  category: ToolCategory.WEB3_READ
}

export const mockPendleTool = {
  name: 'pendle_opportunities',
  description: 'Get Pendle yield opportunities',
  schema: z.object({
    max_results: z.number().optional()
  }),
  execute: jest
    .fn()
    .mockResolvedValue([{ name: 'Test Opportunity', impliedApy: 0.05 }]),
  category: ToolCategory.WEB3_READ
}

export const mockKodiakTool = {
  name: 'kodiak_opportunities',
  description: 'Get Kodiak yield opportunities',
  schema: z.object({
    max_results: z.number().optional()
  }),
  execute: jest
    .fn()
    .mockResolvedValue([{ name: 'Test Opportunity', apy: 0.05 }]),
  category: ToolCategory.WEB3_READ
}

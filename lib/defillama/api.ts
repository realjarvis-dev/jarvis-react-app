import axios from 'axios'
import type { 
  DeFiLlamaProtocol, 
  DeFiLlamaYield, 
  DeFiLlamaTVLData,
  DeFiLlamaChain,
  ProtocolsFilters,
  YieldsFilters 
} from './types'

const DEFILLAMA_BASE_URL = 'https://api.llama.fi'
const TIMEOUT = 10000

// Create axios instance with timeout
const apiClient = axios.create({
  baseURL: DEFILLAMA_BASE_URL,
  timeout: TIMEOUT,
})

/**
 * Fetch all protocols from DeFiLlama
 */
export async function fetchProtocols(): Promise<DeFiLlamaProtocol[]> {
  try {
    const response = await apiClient.get<DeFiLlamaProtocol[]>('/protocols')
    return response.data
  } catch (error) {
    console.error('Failed to fetch DeFiLlama protocols:', error)
    throw new Error('Failed to fetch protocols data')
  }
}

/**
 * Fetch yield pools from DeFiLlama
 */
export async function fetchYields(): Promise<DeFiLlamaYield[]> {
  try {
    const response = await apiClient.get<{ data: DeFiLlamaYield[] }>('/yields')
    return response.data.data || []
  } catch (error) {
    console.error('Failed to fetch DeFiLlama yields:', error)
    throw new Error('Failed to fetch yields data')
  }
}

/**
 * Fetch protocol TVL history
 */
export async function fetchProtocolTVL(protocol: string): Promise<DeFiLlamaTVLData[]> {
  try {
    const response = await apiClient.get<DeFiLlamaTVLData[]>(`/protocol/${protocol}`)
    return response.data
  } catch (error) {
    console.error(`Failed to fetch TVL for protocol ${protocol}:`, error)
    throw new Error(`Failed to fetch TVL data for ${protocol}`)
  }
}

/**
 * Fetch chains data
 */
export async function fetchChains(): Promise<DeFiLlamaChain[]> {
  try {
    const response = await apiClient.get<DeFiLlamaChain[]>('/chains')
    return response.data
  } catch (error) {
    console.error('Failed to fetch DeFiLlama chains:', error)
    throw new Error('Failed to fetch chains data')
  }
}

/**
 * Fetch TVL for a specific chain
 */
export async function fetchChainTVL(chain: string): Promise<DeFiLlamaTVLData[]> {
  try {
    const response = await apiClient.get<DeFiLlamaTVLData[]>(`/tvl/${chain}`)
    return response.data
  } catch (error) {
    console.error(`Failed to fetch TVL for chain ${chain}:`, error)
    throw new Error(`Failed to fetch TVL data for ${chain}`)
  }
}

/**
 * Filter and sort protocols based on criteria
 */
export function filterProtocols(
  protocols: DeFiLlamaProtocol[], 
  filters: ProtocolsFilters
): DeFiLlamaProtocol[] {
  let filtered = [...protocols]

  // Apply filters
  if (filters.category) {
    filtered = filtered.filter(p => 
      p.category.toLowerCase().includes(filters.category!.toLowerCase())
    )
  }

  if (filters.chain) {
    filtered = filtered.filter(p => 
      p.chains.some(chain => 
        chain.toLowerCase().includes(filters.chain!.toLowerCase())
      )
    )
  }

  if (filters.minTvl !== undefined) {
    filtered = filtered.filter(p => p.tvl >= filters.minTvl!)
  }

  if (filters.maxTvl !== undefined) {
    filtered = filtered.filter(p => p.tvl <= filters.maxTvl!)
  }

  // Apply sorting
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (filters.sortBy) {
        case 'tvl':
          aValue = a.tvl
          bValue = b.tvl
          break
        case 'change_1d':
          aValue = a.change_1d || 0
          bValue = b.change_1d || 0
          break
        case 'change_7d':
          aValue = a.change_7d || 0
          bValue = b.change_7d || 0
          break
        case 'change_1h':
          aValue = a.change_1h || 0
          bValue = b.change_1h || 0
          break
        default:
          aValue = a.tvl
          bValue = b.tvl
      }

      const result = filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      return result
    })
  }

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    filtered = filtered.slice(0, filters.limit)
  }

  return filtered
}

/**
 * Filter and sort yields based on criteria  
 */
export function filterYields(
  yields: DeFiLlamaYield[], 
  filters: YieldsFilters
): DeFiLlamaYield[] {
  let filtered = [...yields]

  // Apply filters
  if (filters.chain) {
    filtered = filtered.filter(y => 
      y.chain.toLowerCase().includes(filters.chain!.toLowerCase())
    )
  }

  if (filters.project) {
    filtered = filtered.filter(y => 
      y.project.toLowerCase().includes(filters.project!.toLowerCase())
    )
  }

  if (filters.minTvl !== undefined) {
    filtered = filtered.filter(y => y.tvlUsd >= filters.minTvl!)
  }

  if (filters.maxTvl !== undefined) {
    filtered = filtered.filter(y => y.tvlUsd <= filters.maxTvl!)
  }

  if (filters.minApy !== undefined) {
    filtered = filtered.filter(y => y.apy >= filters.minApy!)
  }

  if (filters.maxApy !== undefined) {
    filtered = filtered.filter(y => y.apy <= filters.maxApy!)
  }

  if (filters.stablecoin !== undefined) {
    filtered = filtered.filter(y => y.stablecoin === filters.stablecoin!)
  }

  // Apply sorting
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (filters.sortBy) {
        case 'apy':
          aValue = a.apy
          bValue = b.apy
          break
        case 'tvlUsd':
          aValue = a.tvlUsd
          bValue = b.tvlUsd
          break
        case 'apyBase':
          aValue = a.apyBase || 0
          bValue = b.apyBase || 0
          break
        case 'apyReward':
          aValue = a.apyReward || 0
          bValue = b.apyReward || 0
          break
        default:
          aValue = a.apy
          bValue = b.apy
      }

      const result = filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      return result
    })
  }

  // Apply limit
  if (filters.limit && filters.limit > 0) {
    filtered = filtered.slice(0, filters.limit)
  }

  return filtered
}

/**
 * Get top gainers over 7 days with TVL over $1M
 */
export function getTopGainers(protocols: DeFiLlamaProtocol[], limit = 20): DeFiLlamaProtocol[] {
  return filterProtocols(protocols, {
    minTvl: 1_000_000, // $1M minimum TVL
    sortBy: 'change_7d',
    sortOrder: 'desc',
    limit
  }).filter(p => p.change_7d && p.change_7d > 0)
}

/**
 * Get top protocols by TVL with minimum TVL threshold
 */
export function getTopProtocolsByTVL(protocols: DeFiLlamaProtocol[], limit = 20): DeFiLlamaProtocol[] {
  return filterProtocols(protocols, {
    minTvl: 1_000_000, // $1M minimum TVL
    sortBy: 'tvl',
    sortOrder: 'desc',
    limit
  })
}

/**
 * Get high yield opportunities
 */
export function getHighYieldOpportunities(yields: DeFiLlamaYield[], limit = 20): DeFiLlamaYield[] {
  return filterYields(yields, {
    minTvl: 100_000, // $100K minimum TVL
    minApy: 5, // 5% minimum APY
    sortBy: 'apy',
    sortOrder: 'desc',
    limit
  }).filter(y => !y.outlier) // Filter out outliers
}
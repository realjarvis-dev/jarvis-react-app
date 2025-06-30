import type { DeFiLlamaProtocol, DeFiLlamaYield, DeFiOpportunity } from './types'

/**
 * Format large numbers with appropriate suffixes (K, M, B, T)
 */
export function formatTVL(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

/**
 * Format percentage with appropriate decimal places
 */
export function formatPercentage(value: number | null): string {
  if (value === null || value === undefined) {
    return 'N/A'
  }
  
  const absValue = Math.abs(value)
  let decimals = 2
  
  if (absValue < 0.01) {
    decimals = 4
  } else if (absValue < 0.1) {
    decimals = 3
  }
  
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/**
 * Format APY percentage
 */
export function formatAPY(apy: number): string {
  if (apy >= 1000) {
    return `${(apy / 100).toFixed(0)}x`
  } else if (apy >= 100) {
    return `${apy.toFixed(0)}%`
  } else if (apy >= 10) {
    return `${apy.toFixed(1)}%`
  } else {
    return `${apy.toFixed(2)}%`
  }
}

/**
 * Format reward token address to show more meaningful information
 */
export function formatRewardToken(token: string): string {
  // Common token addresses to names mapping
  const knownTokens: Record<string, string> = {
    '0xa0b86a33e6441986c3740012f9e01847a919de8e': 'CRV',
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
    '0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b': 'CRV',
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'AAVE',
    '0x6dea81c8171d0ba574754ef6f8b412f2ed88c54d': 'LQTY',
    '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b': 'CVX',
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'UNI',
    '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72': 'ENS',
    '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'MKR',
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
    '0xd533a949740bb3306d119cc777fa900ba034cd52': 'CRV', // The actual CRV token address
    '0x0000000000000000000000000000000000000000': 'ETH'
  }

  // Convert to lowercase for lookup
  const lowerToken = token.toLowerCase()
  
  // Check if it's a known token
  if (knownTokens[lowerToken]) {
    return knownTokens[lowerToken]
  }
  
  // If it's an address (starts with 0x), show a shortened version
  if (token.startsWith('0x') && token.length === 42) {
    return `${token.slice(0, 6)}...${token.slice(-4)}`
  }
  
  // If it's already a symbol/name, show first 8 characters
  return token.length > 8 ? `${token.slice(0, 8)}...` : token
}

/**
 * Get risk level based on various factors
 */
export function getRiskLevel(protocol: DeFiLlamaProtocol): 'low' | 'medium' | 'high' {
  const audits = parseInt(protocol.audits) || 0
  const tvl = protocol.tvl
  const change7d = Math.abs(protocol.change_7d || 0)
  
  // Low risk: High TVL, audited, stable
  if (tvl > 1e9 && audits >= 2 && change7d < 20) {
    return 'low'
  }
  
  // High risk: Low TVL, unaudited, high volatility
  if (tvl < 10e6 || audits === 0 || change7d > 50) {
    return 'high'
  }
  
  return 'medium'
}

/**
 * Get momentum based on price changes
 */
export function getMomentum(protocol: DeFiLlamaProtocol): 'strong' | 'moderate' | 'weak' {
  const change1h = protocol.change_1h || 0
  const change1d = protocol.change_1d || 0
  const change7d = protocol.change_7d || 0
  
  // Strong positive momentum
  if (change1h > 2 && change1d > 5 && change7d > 15) {
    return 'strong'
  }
  
  // Weak or negative momentum
  if (change1h < -1 || change1d < -2 || change7d < -5) {
    return 'weak'
  }
  
  return 'moderate'
}

/**
 * Get category color for UI - Professional consistent styling with transparency
 */
export function getCategoryColor(category: string): string {
  const categoryColors: Record<string, string> = {
    'Lending': '!bg-blue-500/20 !text-blue-700 !border-blue-500/40 dark:!bg-blue-400/20 dark:!text-blue-300 dark:!border-blue-400/40',
    'DEX': '!bg-emerald-500/20 !text-emerald-700 !border-emerald-500/40 dark:!bg-emerald-400/20 dark:!text-emerald-300 dark:!border-emerald-400/40',
    'Dexs': '!bg-emerald-500/20 !text-emerald-700 !border-emerald-500/40 dark:!bg-emerald-400/20 dark:!text-emerald-300 dark:!border-emerald-400/40',
    'Liquid Staking': '!bg-purple-500/20 !text-purple-700 !border-purple-500/40 dark:!bg-purple-400/20 dark:!text-purple-300 dark:!border-purple-400/40',
    'Restaking': '!bg-indigo-500/20 !text-indigo-700 !border-indigo-500/40 dark:!bg-indigo-400/20 dark:!text-indigo-300 dark:!border-indigo-400/40',
    'Yield': '!bg-amber-500/20 !text-amber-700 !border-amber-500/40 dark:!bg-amber-400/20 dark:!text-amber-300 dark:!border-amber-400/40',
    'CDP': '!bg-orange-500/20 !text-orange-700 !border-orange-500/40 dark:!bg-orange-400/20 dark:!text-orange-300 dark:!border-orange-400/40',
    'Bridge': '!bg-slate-500/20 !text-slate-700 !border-slate-500/40 dark:!bg-slate-400/20 dark:!text-slate-300 dark:!border-slate-400/40',
    'CEX': '!bg-red-500/20 !text-red-700 !border-red-500/40 dark:!bg-red-400/20 dark:!text-red-300 dark:!border-red-400/40',
    'Derivatives': '!bg-pink-500/20 !text-pink-700 !border-pink-500/40 dark:!bg-pink-400/20 dark:!text-pink-300 dark:!border-pink-400/40',
    'Synthetics': '!bg-cyan-500/20 !text-cyan-700 !border-cyan-500/40 dark:!bg-cyan-400/20 dark:!text-cyan-300 dark:!border-cyan-400/40',
    'Insurance': '!bg-teal-500/20 !text-teal-700 !border-teal-500/40 dark:!bg-teal-400/20 dark:!text-teal-300 dark:!border-teal-400/40',
    'Options': '!bg-violet-500/20 !text-violet-700 !border-violet-500/40 dark:!bg-violet-400/20 dark:!text-violet-300 dark:!border-violet-400/40',
    'Launchpad': '!bg-rose-500/20 !text-rose-700 !border-rose-500/40 dark:!bg-rose-400/20 dark:!text-rose-300 dark:!border-rose-400/40',
    'Gaming': '!bg-yellow-500/20 !text-yellow-700 !border-yellow-500/40 dark:!bg-yellow-400/20 dark:!text-yellow-300 dark:!border-yellow-400/40',
    'NFT': '!bg-fuchsia-500/20 !text-fuchsia-700 !border-fuchsia-500/40 dark:!bg-fuchsia-400/20 dark:!text-fuchsia-300 dark:!border-fuchsia-400/40',
    'Cross Chain': '!bg-sky-500/20 !text-sky-700 !border-sky-500/40 dark:!bg-sky-400/20 dark:!text-sky-300 dark:!border-sky-400/40',
    'Liquid Restaking': '!bg-indigo-500/20 !text-indigo-700 !border-indigo-500/40 dark:!bg-indigo-400/20 dark:!text-indigo-300 dark:!border-indigo-400/40',
    'RWA': '!bg-stone-500/20 !text-stone-700 !border-stone-500/40 dark:!bg-stone-400/20 dark:!text-stone-300 dark:!border-stone-400/40',
    'Basis Trading': '!bg-zinc-500/20 !text-zinc-700 !border-zinc-500/40 dark:!bg-zinc-400/20 dark:!text-zinc-300 dark:!border-zinc-400/40',
    // Missing categories with distinct vibrant colors
    'Onchain Capital Allocator': '!bg-teal-500/20 !text-teal-700 !border-teal-500/40 dark:!bg-teal-400/20 dark:!text-teal-300 dark:!border-teal-400/40',
    'Farm': '!bg-lime-500/20 !text-lime-700 !border-lime-500/40 dark:!bg-lime-400/20 dark:!text-lime-300 dark:!border-lime-400/40',
    'Collateral Management': '!bg-cyan-500/20 !text-cyan-700 !border-cyan-500/40 dark:!bg-cyan-400/20 dark:!text-cyan-300 dark:!border-cyan-400/40',
    'Risk Curators': '!bg-yellow-500/20 !text-yellow-700 !border-yellow-500/40 dark:!bg-yellow-400/20 dark:!text-yellow-300 dark:!border-yellow-400/40',
    'Yield Aggregator': '!bg-green-500/20 !text-green-700 !border-green-500/40 dark:!bg-green-400/20 dark:!text-green-300 dark:!border-green-400/40'
  }
  
  return categoryColors[category] || '!bg-neutral-500/20 !text-neutral-700 !border-neutral-500/40 dark:!bg-neutral-400/20 dark:!text-neutral-300 dark:!border-neutral-400/40'
}

/**
 * Get risk color for UI - Professional consistent styling with transparency
 */
export function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low':
      return '!bg-teal-500/20 !border-teal-500/50 dark:!bg-teal-400/20 dark:!border-teal-400/50'
    case 'medium':
      return '!bg-yellow-500/20 !border-yellow-500/50 dark:!bg-yellow-400/20 dark:!border-yellow-400/50'
    case 'high':
      return '!bg-red-500/20 !border-red-500/50 dark:!bg-red-400/20 dark:!border-red-400/50'
    default:
      return '!bg-gray-500/20 !border-gray-500/50 dark:!bg-gray-400/20 dark:!border-gray-400/50'
  }
}

export function getRiskTextColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low':
      return 'text-teal-700 dark:text-teal-300'
    case 'medium':
      return 'text-yellow-700 dark:text-yellow-300'
    case 'high':
      return 'text-red-700 dark:text-red-300'
    default:
      return 'text-gray-700 dark:text-gray-300'
  }
}

/**
 * Get momentum color for UI - Professional consistent styling with transparency
 */
export function getMomentumColor(momentum: 'strong' | 'moderate' | 'weak'): string {
  switch (momentum) {
    case 'strong':
      return 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40 dark:bg-emerald-400/20 dark:text-emerald-300 dark:border-emerald-400/40'
    case 'moderate':
      return 'bg-blue-500/20 text-blue-700 border-blue-500/40 dark:bg-blue-400/20 dark:text-blue-300 dark:border-blue-400/40'
    case 'weak':
      return 'bg-orange-500/20 text-orange-700 border-orange-500/40 dark:bg-orange-400/20 dark:text-orange-300 dark:border-orange-400/40'
    default:
      return 'bg-neutral-500/20 text-neutral-700 border-neutral-500/40 dark:bg-neutral-400/20 dark:text-neutral-300 dark:border-neutral-400/40'
  }
}

/**
 * Get change color based on positive/negative value
 */
export function getChangeColor(change: number | null): string {
  if (change === null || change === undefined) {
    return 'text-gray-500'
  }
  
  return change >= 0 ? 'text-green-600' : 'text-red-600'
}

/**
 * Clean and validate protocol data
 */
export function sanitizeProtocol(protocol: any): DeFiLlamaProtocol | null {
  try {
    // Ensure required fields exist
    if (!protocol.id || !protocol.name || typeof protocol.tvl !== 'number') {
      return null
    }

    return {
      id: String(protocol.id),
      name: String(protocol.name),
      address: protocol.address || null,
      symbol: String(protocol.symbol || ''),
      url: String(protocol.url || ''),
      description: String(protocol.description || ''),
      chain: String(protocol.chain || ''),
      logo: String(protocol.logo || ''),
      audits: String(protocol.audits || '0'),
      audit_note: protocol.audit_note || null,
      gecko_id: protocol.gecko_id || null,
      cmcId: protocol.cmcId || null,
      category: String(protocol.category || 'Other'),
      chains: Array.isArray(protocol.chains) ? protocol.chains : [],
      module: String(protocol.module || ''),
      twitter: protocol.twitter || null,
      forkedFrom: Array.isArray(protocol.forkedFrom) ? protocol.forkedFrom : [],
      listedAt: Number(protocol.listedAt) || 0,
      methodology: protocol.methodology || undefined,
      slug: String(protocol.slug || ''),
      tvl: Number(protocol.tvl) || 0,
      chainTvls: protocol.chainTvls || {},
      change_1h: typeof protocol.change_1h === 'number' ? protocol.change_1h : null,
      change_1d: typeof protocol.change_1d === 'number' ? protocol.change_1d : null,
      change_7d: typeof protocol.change_7d === 'number' ? protocol.change_7d : null,
      tokenBreakdowns: protocol.tokenBreakdowns || {},
      mcap: typeof protocol.mcap === 'number' ? protocol.mcap : null,
      staking: typeof protocol.staking === 'number' ? protocol.staking : undefined,
      pool2: typeof protocol.pool2 === 'number' ? protocol.pool2 : undefined
    }
  } catch (error) {
    console.error('Failed to sanitize protocol:', error)
    return null
  }
}

/**
 * Generate DeFi opportunities analysis
 */
export function analyzeDeFiOpportunities(
  protocols: DeFiLlamaProtocol[],
  yields: DeFiLlamaYield[]
): DeFiOpportunity[] {
  const opportunities: DeFiOpportunity[] = []
  
  // Focus on protocols with high 7-day growth and significant TVL
  const topGainers = protocols
    .filter(p => p.tvl > 1_000_000 && p.change_7d && p.change_7d > 10)
    .sort((a, b) => (b.change_7d || 0) - (a.change_7d || 0))
    .slice(0, 20)
  
  for (const protocol of topGainers) {
    // Find related yield opportunities
    const relatedYields = yields.filter(y => 
      y.project.toLowerCase().includes(protocol.name.toLowerCase()) ||
      protocol.name.toLowerCase().includes(y.project.toLowerCase())
    )
    
    opportunities.push({
      protocol,
      opportunities: {
        tvlGrowth: protocol.change_7d || 0,
        yieldOpportunities: relatedYields.slice(0, 5), // Top 5 yields
        riskLevel: getRiskLevel(protocol),
        momentum: getMomentum(protocol)
      }
    })
  }
  
  return opportunities
}
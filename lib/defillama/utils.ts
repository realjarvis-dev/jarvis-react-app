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
 * Get category color for UI - Professional consistent styling
 */
export function getCategoryColor(category: string): string {
  const categoryColors: Record<string, string> = {
    'Lending': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    'DEX': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    'Liquid Staking': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    'Restaking': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    'Yield': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    'CDP': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
    'Bridge': 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/50 dark:text-slate-300 dark:border-slate-800',
    'CEX': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
    'Derivatives': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800',
    'Synthetics': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
    'Insurance': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
    'Options': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
    'Launchpad': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    'Gaming': 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800',
    'NFT': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-800',
    'Cross Chain': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    'Liquid Restaking': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    'RWA': 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-950/50 dark:text-stone-300 dark:border-stone-800',
    'Basis Trading': 'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-950/50 dark:text-zinc-300 dark:border-zinc-800'
  }
  
  return categoryColors[category] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/50 dark:text-gray-300 dark:border-gray-800'
}

/**
 * Get risk color for UI - Professional consistent styling
 */
export function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/50 dark:text-gray-300 dark:border-gray-800'
  }
}

/**
 * Get momentum color for UI - Professional consistent styling
 */
export function getMomentumColor(momentum: 'strong' | 'moderate' | 'weak'): string {
  switch (momentum) {
    case 'strong':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
    case 'moderate':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
    case 'weak':
      return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/50 dark:text-gray-300 dark:border-gray-800'
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
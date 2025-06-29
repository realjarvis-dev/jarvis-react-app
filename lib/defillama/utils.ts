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
 * Get category color for UI
 */
export function getCategoryColor(category: string): string {
  const categoryColors: Record<string, string> = {
    'Lending': 'bg-blue-100 text-blue-800',
    'DEX': 'bg-green-100 text-green-800',
    'Liquid Staking': 'bg-purple-100 text-purple-800',
    'Restaking': 'bg-indigo-100 text-indigo-800',
    'Yield': 'bg-yellow-100 text-yellow-800',
    'CDP': 'bg-orange-100 text-orange-800',
    'Bridge': 'bg-gray-100 text-gray-800',
    'CEX': 'bg-red-100 text-red-800',
    'Derivatives': 'bg-pink-100 text-pink-800',
    'Synthetics': 'bg-cyan-100 text-cyan-800',
    'Insurance': 'bg-emerald-100 text-emerald-800',
    'Options': 'bg-violet-100 text-violet-800',
    'Launchpad': 'bg-rose-100 text-rose-800',
    'Gaming': 'bg-amber-100 text-amber-800',
    'NFT': 'bg-fuchsia-100 text-fuchsia-800',
    'Cross Chain': 'bg-teal-100 text-teal-800',
    'Liquid Restaking': 'bg-slate-100 text-slate-800',
    'RWA': 'bg-stone-100 text-stone-800',
    'Basis Trading': 'bg-zinc-100 text-zinc-800'
  }
  
  return categoryColors[category] || 'bg-gray-100 text-gray-800'
}

/**
 * Get risk color for UI
 */
export function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low':
      return 'bg-green-100 text-green-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'high':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get momentum color for UI
 */
export function getMomentumColor(momentum: 'strong' | 'moderate' | 'weak'): string {
  switch (momentum) {
    case 'strong':
      return 'bg-green-100 text-green-800'
    case 'moderate':
      return 'bg-blue-100 text-blue-800'
    case 'weak':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
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
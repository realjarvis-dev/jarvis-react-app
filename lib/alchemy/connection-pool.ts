import { Alchemy } from 'alchemy-sdk'
import { allNetworkConfigs } from '../network/config'

/**
 * Connection pool for Alchemy clients to optimize memory usage
 */
export class AlchemyConnectionPool {
  private pool: Map<number, {
    client: Alchemy
    lastUsed: number
    useCount: number
  }> = new Map()
  
  private readonly MAX_POOL_SIZE = 5 // Limit concurrent connections
  private readonly CONNECTION_TIMEOUT = 600000 // 10 minutes
  private readonly CLEANUP_INTERVAL = 300000 // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor() {
    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL)
  }

  /**
   * Get Alchemy client for a chain ID with connection pooling
   */
  getClient(chainId: number): Alchemy {
    const now = Date.now()
    
    // Check if we have an active connection
    if (this.pool.has(chainId)) {
      const conn = this.pool.get(chainId)!
      
      // Check if connection is still valid
      if (now - conn.lastUsed < this.CONNECTION_TIMEOUT) {
        conn.lastUsed = now
        conn.useCount++
        return conn.client
      }
      
      // Remove expired connection
      this.pool.delete(chainId)
    }

    // Create new connection
    if (this.pool.size >= this.MAX_POOL_SIZE) {
      this.evictLeastUsedConnection()
    }

    const client = this.createClient(chainId)
    this.pool.set(chainId, {
      client,
      lastUsed: now,
      useCount: 1
    })

    return client
  }

  /**
   * Create a new Alchemy client for the specified chain
   */
  private createClient(chainId: number): Alchemy {
    const network = Object.values(allNetworkConfigs).find(
      config => config.chainId === chainId
    )

    if (!network?.alchemyNetwork) {
      throw new Error(`No Alchemy network configuration found for chain ID ${chainId}`)
    }

    return new Alchemy({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: network.alchemyNetwork,
      maxRetries: 3,
      requestTimeout: 30000,
      connectionInfoOverrides: { skipFetchSetup: true }
    })
  }

  /**
   * Evict the least used connection to make room for new ones
   */
  private evictLeastUsedConnection(): void {
    let leastUsedChainId: number | null = null
    let leastUsedCount = Infinity
    let oldestLastUsed = Infinity

    for (const [chainId, conn] of this.pool.entries()) {
      if (conn.useCount < leastUsedCount || 
          (conn.useCount === leastUsedCount && conn.lastUsed < oldestLastUsed)) {
        leastUsedChainId = chainId
        leastUsedCount = conn.useCount
        oldestLastUsed = conn.lastUsed
      }
    }

    if (leastUsedChainId !== null) {
      this.pool.delete(leastUsedChainId)
      console.log(`🔄 Evicted Alchemy connection for chain ${leastUsedChainId}`)
    }
  }

  /**
   * Clean up expired connections
   */
  private cleanup(): void {
    const now = Date.now()
    const expiredConnections: number[] = []

    for (const [chainId, conn] of this.pool.entries()) {
      if (now - conn.lastUsed > this.CONNECTION_TIMEOUT) {
        expiredConnections.push(chainId)
      }
    }

    for (const chainId of expiredConnections) {
      this.pool.delete(chainId)
      console.log(`🧹 Cleaned up expired Alchemy connection for chain ${chainId}`)
    }

    if (expiredConnections.length > 0) {
      console.log(`♻️ Alchemy connection pool: ${this.pool.size} active connections`)
    }
  }

  /**
   * Get pool statistics for monitoring
   */
  getStats(): {
    activeConnections: number
    totalRequests: number
    avgRequestsPerConnection: number
    oldestConnectionAge: number
  } {
    const now = Date.now()
    let totalRequests = 0
    let oldestConnectionAge = 0

    for (const [chainId, conn] of this.pool.entries()) {
      totalRequests += conn.useCount
      const age = now - conn.lastUsed
      if (age > oldestConnectionAge) {
        oldestConnectionAge = age
      }
    }

    return {
      activeConnections: this.pool.size,
      totalRequests,
      avgRequestsPerConnection: this.pool.size > 0 ? totalRequests / this.pool.size : 0,
      oldestConnectionAge
    }
  }

  /**
   * Force close all connections (for graceful shutdown)
   */
  closeAll(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.pool.clear()
    console.log('🔐 Closed all Alchemy connections')
  }
}

// Export singleton instance
export const alchemyConnectionPool = new AlchemyConnectionPool()
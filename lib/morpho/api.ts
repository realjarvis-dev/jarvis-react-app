import { 
  MorphoMarket, 
  MorphoMarketsResponse, 
  BorrowingRateData, 
  LoopingOpportunity 
} from './types'

const MORPHO_API_URL = 'https://api.morpho.org/graphql'

export class MorphoAPI {
  private async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      const response = await fetch(MORPHO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.errors) {
        throw new Error(`GraphQL error: ${data.errors[0].message}`)
      }

      return data.data
    } catch (error) {
      console.error('Morpho API query failed:', error)
      throw error
    }
  }

  /**
   * Get all markets with borrowing rates
   */
  async getMarkets(chainIds: number[] = [1, 8453]): Promise<MorphoMarket[]> {
    const query = `
      query GetMarkets($chainIds: [Int!]!) {
        markets(
          first: 1000
          orderBy: SupplyAssetsUsd
          orderDirection: Desc
          where: { chainId_in: $chainIds }
        ) {
          items {
            uniqueKey
            lltv
            oracleAddress
            irmAddress
            loanAsset {
              address
              symbol
              decimals
            }
            collateralAsset {
              address
              symbol
              decimals
            }
            state {
              borrowAssets
              supplyAssets
              borrowAssetsUsd
              supplyAssetsUsd
              fee
              utilization
              supplyApy
              borrowApy
              rewards {
                asset { address }
                supplyApr
                borrowApr
              }
            }
          }
        }
      }
    `

    const response = await this.query<MorphoMarketsResponse>(query, { chainIds })
    return response.markets.items
  }

  /**
   * Get borrowing rates for PT token markets
   */
  async getPTTokenBorrowingRates(ptTokenAddresses: string[], chainIds?: number[]): Promise<BorrowingRateData[]> {
    const markets = await this.getMarkets(chainIds)
    
    return markets
      .filter(market => {
        // Add null safety checks
        if (!market || !market.collateralAsset || !market.collateralAsset.address) {
          return false
        }
        // Filter out markets with zero liquidity
        const totalSupply = parseFloat(market.state.supplyAssets || '0')
        const totalBorrow = parseFloat(market.state.borrowAssets || '0')
        if (totalSupply === 0 && totalBorrow === 0) {
          return false
        }
        return ptTokenAddresses.some(ptAddress => 
          market.collateralAsset.address.toLowerCase() === ptAddress.toLowerCase()
        )
      })
      .map(market => {
        const totalSupply = parseFloat(market.state.supplyAssets)
        const totalBorrow = parseFloat(market.state.borrowAssets)
        const availableLiquidity = totalSupply - totalBorrow
        
        return {
          marketKey: market.uniqueKey,
          borrowApy: market.state.borrowApy,
          supplyApy: market.state.supplyApy,
          utilization: parseFloat(market.state.utilization),
          totalBorrowAssets: totalBorrow,
          totalSupplyAssets: totalSupply,
          availableLiquidity: Math.max(0, availableLiquidity),
          collateralAsset: market.collateralAsset.address,
          loanAsset: market.loanAsset.address,
          maxLtv: parseFloat(market.lltv) / 1e18
        }
      })
  }

  /**
   * Get specific market by unique key
   */
  async getMarketByKey(uniqueKey: string): Promise<MorphoMarket | null> {
    const query = `
      query GetMarket($uniqueKey: String!) {
        marketByUniqueKey(uniqueKey: $uniqueKey) {
          uniqueKey
          lltv
          oracleAddress
          irmAddress
          loanAsset {
            address
            symbol
            decimals
          }
          collateralAsset {
            address
            symbol
            decimals
          }
          state {
            borrowAssets
            supplyAssets
            borrowAssetsUsd
            supplyAssetsUsd
            fee
            utilization
            supplyApy
            borrowApy
            rewards {
              asset { address }
              supplyApr
              borrowApr
            }
          }
        }
      }
    `

    try {
      const response = await this.query<{ marketByUniqueKey: MorphoMarket }>(query, { uniqueKey })
      return response.marketByUniqueKey
    } catch (error) {
      console.error(`Failed to fetch market ${uniqueKey}:`, error)
      return null
    }
  }

  /**
   * Calculate health factor for a position
   */
  calculateHealthFactor(
    collateralValue: number,
    borrowValue: number,
    maxLtv: number
  ): number {
    if (borrowValue === 0) return Infinity
    return (collateralValue * maxLtv) / borrowValue
  }

  /**
   * Calculate optimal leverage for a looping position
   */
  calculateOptimalLeverage(
    ptYield: number,
    borrowRate: number,
    maxLtv: number,
    riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): number {
    const yieldSpread = ptYield - borrowRate
    
    if (yieldSpread <= 0) return 1 // No benefit to leveraging
    
    // Conservative approach: aim for health factor > 2.0
    // Moderate: health factor > 1.5
    // Aggressive: health factor > 1.2
    const targetHealthFactors = {
      conservative: 2.0,
      moderate: 1.5,
      aggressive: 1.2
    }
    
    const targetHealthFactor = targetHealthFactors[riskTolerance]
    
    // Correct leverage calculation:
    // Health Factor = (Collateral Value * LTV) / Debt
    // With leverage L: Collateral = Initial * L, Debt = Initial * (L - 1)
    // HF = (Initial * L * LTV) / (Initial * (L - 1)) = (L * LTV) / (L - 1)
    // Solving for L: L = targetHF / (targetHF - LTV)
    const maxSafeLeverage = targetHealthFactor / (targetHealthFactor - maxLtv)
    
    // Also consider yield efficiency - diminishing returns at high leverage
    const optimalYieldLeverage = 1 + (yieldSpread * 2) // More aggressive scaling
    
    return Math.min(maxSafeLeverage, optimalYieldLeverage, 5) // Cap at 5x max
  }

  /**
   * Estimate APY at different leverage levels
   */
  estimateAPYAtLeverage(
    ptYield: number,
    borrowRate: number,
    leverage: number
  ): number {
    // Leveraged APY = ptYield * leverage - borrowRate * (leverage - 1)
    return ptYield * leverage - borrowRate * (leverage - 1)
  }
}

export const morphoAPI = new MorphoAPI()
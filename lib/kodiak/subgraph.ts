/**
 * Kodiak Islands Subgraph API
 * Handles queries to the Kodiak Islands subgraph for fetching real data
 */

import axios from 'axios';
import { KodiakIsland } from '../types/kodiak';

// Zero address constant (ethers v6 compatible)
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Subgraph endpoints
export const SUBGRAPH_ENDPOINTS = {
  mainnet: 'https://api.goldsky.com/api/public/project_clpx84oel0al201r78jsl0r3i/subgraphs/kodiak-v3-berachain-mainnet/latest/gn',
  bepolia: 'https://api.goldsky.com/api/public/project_clpx84oel0al201r78jsl0r3i/subgraphs/kodiak-v3-berachain-testnet/latest/gn'
};

/**
 * Fetch vault data from the Kodiak Islands subgraph
 * @param network Network to query (mainnet or bepolia)
 * @returns Promise with vault data
 */
export async function fetchVaultsFromSubgraph(network: 'mainnet' | 'bepolia' = 'mainnet'): Promise<any[]> {
  try {
    const endpoint = SUBGRAPH_ENDPOINTS[network];
    
    const query = `
      query {
        kodiakVaults(first: 1000) {
          id
          name
          totalValueLockedUSD
          lowerTick
          upperTick
          manager
          managerFee
          _token0 {
            id
            symbol
            decimals
          }
          _token1 {
            id
            symbol
            decimals
          }
          _token0Amount
          _token1Amount
          _token0AmountUSD
          _token1AmountUSD
          volumeUSD
          weeklyVolumeUSD
          apr {
            averageApr
          }
          isManaged: manager
          pool {
            id
            feeTier
            liquidity
            sqrtPrice
            tick
          }
        }
      }
    `;
    
    const response = await axios.post(
      endpoint,
      { query }
    );
    
    if (response.data.errors) {
      console.error('Subgraph query errors:', response.data.errors);
      return [];
    }
    
    return response.data.data.kodiakVaults || [];
  } catch (error) {
    console.error(`Error fetching Kodiak vaults from ${network} subgraph:`, error);
    return [];
  }
}

/**
 * Fetch a specific vault by address from the subgraph
 * @param address Vault address
 * @param network Network to query (mainnet or bepolia)
 * @returns Promise with vault data
 */
export async function fetchVaultByAddress(address: string, network: 'mainnet' | 'bepolia' = 'mainnet'): Promise<any | null> {
  try {
    const endpoint = SUBGRAPH_ENDPOINTS[network];
    
    const query = `
      query {
        kodiakVault(id: "${address.toLowerCase()}") {
          id
          name
          totalValueLockedUSD
          lowerTick
          upperTick
          manager
          managerFee
          _token0 {
            id
            symbol
            decimals
          }
          _token1 {
            id
            symbol
            decimals
          }
          _token0Amount
          _token1Amount
          _token0AmountUSD
          _token1AmountUSD
          apr {
            averageApr
          }
          pool {
            id
            feeTier
            liquidity
            sqrtPrice
            tick
          }
        }
      }
    `;
    
    const response = await axios.post(
      endpoint,
      { query }
    );
    
    if (response.data.errors) {
      console.error('Subgraph query errors:', response.data.errors);
      return null;
    }
    
    return response.data.data.kodiakVault || null;
  } catch (error) {
    console.error(`Error fetching Kodiak vault ${address} from ${network} subgraph:`, error);
    return null;
  }
}

/**
 * Calculate price from sqrtPriceX96
 * @param sqrtPriceX96 Square root price in X96 format
 * @param token0Decimals Decimals of token0
 * @param token1Decimals Decimals of token1
 * @returns Current price (token1/token0)
 */
export function calculatePriceFromSqrtPrice(sqrtPriceX96: string, token0Decimals: number, token1Decimals: number): number {
  // Formula: price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
  const sqrtPrice = Number(sqrtPriceX96) / Math.pow(2, 96);
  const price = Math.pow(sqrtPrice, 2) * Math.pow(10, token0Decimals - token1Decimals);
  return price;
}

/**
 * Maps subgraph data to our KodiakIsland interface
 * @param vaults Raw vault data from subgraph
 * @returns Array of KodiakIsland objects
 */
export function mapSubgraphDataToIslands(vaults: any[]): KodiakIsland[] {
  return vaults.map(vault => {
    // Determine if the vault is managed
    const isManaged = !!vault.manager && vault.manager !== ZERO_ADDRESS;
    
    // Parse APR from subgraph (averageApr is typically in basis points or percentage)
    let feeApr = 0;
    let isEstimate = true;
    
    if (vault.apr?.averageApr) {
      // Convert from percent to decimal (divide by 100)
      feeApr = parseFloat(vault.apr.averageApr) / 100;
      isEstimate = false;
    }
    
    // Try to determine fee tier from the pool or fall back to name extraction
    let feeTier = vault.pool?.feeTier ? Number(vault.pool.feeTier) : 3000; // Default to 0.3%
    
    // Calculate current price if we have sqrtPrice
    let currentPrice = 0;
    if (vault.pool?.sqrtPrice && vault._token0?.decimals && vault._token1?.decimals) {
      currentPrice = calculatePriceFromSqrtPrice(
        vault.pool.sqrtPrice,
        parseInt(vault._token0.decimals),
        parseInt(vault._token1.decimals)
      );
    }
    
    return {
      address: vault.id,
      name: vault.name || `Kodiak Island ${vault._token0?.symbol}-${vault._token1?.symbol}`,
      token0: {
        address: vault._token0?.id || ZERO_ADDRESS,
        symbol: vault._token0?.symbol || 'UNKNOWN',
        decimals: parseInt(vault._token0?.decimals || '18')
      },
      token1: {
        address: vault._token1?.id || ZERO_ADDRESS,
        symbol: vault._token1?.symbol || 'UNKNOWN',
        decimals: parseInt(vault._token1?.decimals || '18')
      },
      totalSupply: '0', // Not provided in this query
      lowerTick: parseInt(vault.lowerTick || '0'),
      upperTick: parseInt(vault.upperTick || '0'),
      feeTier,
      manager: vault.manager || ZERO_ADDRESS,
      isManaged,
      managerFeeBPS: parseInt(vault.managerFee || '0'),
      tvl: {
        token0Amount: vault._token0Amount || '0',
        token1Amount: vault._token1Amount || '0',
        usdValue: parseFloat(vault.totalValueLockedUSD || '0')
      },
      apr: {
        feeApr,
        combinedApr: feeApr, // Same as feeApr since we don't have additional yield sources
        isEstimate
      },
      volumeUSD: vault.volumeUSD || '0',
      weeklyVolumeUSD: vault.weeklyVolumeUSD || '0',
      currentPrice,
      poolType: 'Island',
      tick: vault.pool?.tick ? Number(vault.pool.tick) : 0
    };
  });
} 
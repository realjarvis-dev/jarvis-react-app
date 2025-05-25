import axios from 'axios';
import { KodiakIsland, KodiakIslandResponse } from '../types/kodiak';

const KODIAK_API_BASE_URL = 'https://backend.kodiak.finance';

/**
 * Interface for the raw Kodiak API response
 */
interface KodiakApiVault {
  id: string;
  provider: string;
  lowerTick: number;
  upperTick: number;
  currentTick: number;
  tvl: number;
  farmTvl: number;
  apr: number;
  weeklyFeesEarnedUSD: number;
  feeTier: number;
  totalApr: number;
  lastUpdated: string;
  isSweetened: boolean;
  isRewardVault: boolean;
  isVolatile: boolean;
  managerTreasury?: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
    price: number;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
    price: number;
  };
  farm?: {
    id: string;
    provider: string;
    tvl: number;
    apr: number;
    rewardRates: string[];
    stakingToken: string;
    rewardTokens: {
      id: string;
      symbol: string;
      name: string;
      decimals: number;
      price: number;
    }[];
  };
  tokenLp?: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
    price: number;
    totalSupply: number;
  };
}

interface KodiakApiResponse {
  data: KodiakApiVault[];
  count: number;
}

/**
 * Fetches Kodiak Islands data from the API endpoint
 * @param options - Options for filtering the API request
 * @returns Promise with KodiakIslandResponse
 */
export async function fetchKodiakIslandsFromApi(
  options: {
    chainId?: number;
    minimumTvl?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: string;
  } = {}
): Promise<KodiakIslandResponse> {
  try {
    console.log('Fetching Kodiak Islands from API endpoint...');
    
    // Default options
    const {
      chainId = 80094, // Default to BERA Mainnet
      minimumTvl = 100, // Default minimum TVL
      limit = 200, // Default limit
      orderBy = 'totalApr', // Default ordering by total APR
      orderDirection = 'desc' // Default to descending order
    } = options;
    
    // Construct the query parameters
    const params = new URLSearchParams({
      chainId: chainId.toString(),
      minimumTvl: minimumTvl.toString(),
      limit: limit.toString(),
      orderBy,
      orderDirection
    });
    
    // Make the API request
    const response = await axios.get<KodiakApiResponse>(`${KODIAK_API_BASE_URL}/vaults?${params.toString()}`);
    
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response from Kodiak API');
    }
    
    console.log(`Successfully fetched ${response.data.data.length} islands from API`);
    
    // Map the API response to our format
    const islands = mapApiResponseToIslands(response.data.data);
    
    // Count unique token pairs
    const tokenPairs = new Set();
    islands.forEach(island => {
      tokenPairs.add(`${island.token0.symbol}-${island.token1.symbol}`);
    });
    
    return {
      success: true,
      data: {
        islands,
        stats: {
          total: islands.length,
          uniquePairs: tokenPairs.size,
          networks: ['mainnet']
        }
      }
    };
  } catch (error) {
    console.error(`Error fetching Kodiak Islands from API: ${error}`);
    return {
      success: false,
      error: `Failed to fetch Kodiak Islands from API: ${error}`
    };
  }
}

/**
 * Maps the API response to our KodiakIsland interface
 * @param apiVaults - Array of vaults from the API
 * @returns Array of KodiakIsland objects
 */
function mapApiResponseToIslands(apiVaults: KodiakApiVault[]): KodiakIsland[] {
  return apiVaults.map(vault => {
    // The API already returns APR values in percentage form
    // We need to convert them to decimal form for our interface
    const feeApr = vault.apr / 100;
    const combinedApr = vault.totalApr / 100;
    const rewardApr = combinedApr - feeApr; // Calculate reward APR
    
    // Extract token0 and token1 balances from the TVL
    // Since the API doesn't directly provide token amounts, we need to estimate them
    // This is an approximation based on the token prices and TVL ratio
    const token0Price = vault.token0.price || 0;
    const token1Price = vault.token1.price || 0;
    
    // Assume a 50/50 split if we don't have more detailed information
    // In a real implementation, you might want to calculate this more accurately
    const totalValue = vault.tvl;
    const token0Value = totalValue / 2;
    const token1Value = totalValue / 2;
    
    const token0Amount = token0Price > 0 ? (token0Value / token0Price).toString() : '0';
    const token1Amount = token1Price > 0 ? (token1Value / token1Price).toString() : '0';
    
    // Use manager treasury as manager if available
    const manager = vault.managerTreasury || '0x0000000000000000000000000000000000000000';
    
    return {
      address: vault.id,
      name: vault.tokenLp?.name || `Kodiak Island ${vault.token0.symbol}-${vault.token1.symbol}`,
      token0: {
        address: vault.token0.id,
        symbol: vault.token0.symbol,
        decimals: vault.token0.decimals
      },
      token1: {
        address: vault.token1.id,
        symbol: vault.token1.symbol,
        decimals: vault.token1.decimals
      },
      totalSupply: vault.tokenLp?.totalSupply?.toString() || '0',
      lowerTick: vault.lowerTick,
      upperTick: vault.upperTick,
      feeTier: vault.feeTier,
      manager,
      isManaged: !!vault.managerTreasury,
      managerFeeBPS: 0, // Not provided in the API response
      tvl: {
        token0Amount,
        token1Amount,
        usdValue: vault.tvl
      },
      apr: {
        feeApr,
        rewardApr, // Add the reward APR field
        combinedApr,
        isEstimate: false // Data coming from API, so not an estimate
      },
      volumeUSD: (vault.weeklyFeesEarnedUSD * 52).toString(), // Approximating annual volume based on weekly fees
      weeklyVolumeUSD: vault.weeklyFeesEarnedUSD.toString(),
      currentPrice: 0, // Not directly provided, would need calculation
      poolType: 'Island',
      tick: vault.currentTick
    };
  });
}

/**
 * Gets Kodiak investment opportunities from the API
 * @param options Filter options
 * @returns Array of KodiakIsland objects
 */
export async function getKodiakOpportunitiesFromApi(
  options: {
    minTvl?: number;
    includeInactive?: boolean;
    minVolumeUSD?: number;
    chainId?: number;
  } = {}
): Promise<KodiakIsland[]> {
  // Set default options
  const {
    minTvl = 100, // Default minimum TVL
    includeInactive = false, // By default, filter out inactive islands
    chainId = 80094 // Default to BERA Mainnet
  } = options;
  
  try {
    // Fetch islands from API, already filtering by minTvl
    const islandsResponse = await fetchKodiakIslandsFromApi({
      chainId,
      minimumTvl: minTvl,
      limit: 200,
      orderBy: 'totalApr',
      orderDirection: 'desc'
    });
    
    if (!islandsResponse.success || !islandsResponse.data) {
      throw new Error(islandsResponse.error || 'Failed to fetch islands');
    }
    
    let islands = islandsResponse.data.islands;
    
    // Apply additional filters
    const activeIslands = islands.filter(island => {
      // Filter out inactive islands if specified
      if (!includeInactive) {
        // Consider an island inactive if both APRs are zero
        if (island.apr.feeApr === 0 && island.apr.combinedApr === 0) {
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`Found ${activeIslands.length} active Kodiak Islands from API`);
    return activeIslands;
  } catch (error) {
    console.error('Error getting Kodiak opportunities from API:', error);
    return [];
  }
} 
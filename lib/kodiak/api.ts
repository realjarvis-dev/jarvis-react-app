import axios from 'axios';
import { ethers } from 'ethers';
import { berachainConfig } from '@/lib/network/config';
import {
  buildKodiakIslandObject,
  KodiakApiResponse,
  KodiakApiVault,
  KodiakIsland,
  KodiakIslandResponse
} from '../types/kodiak';
import { FACTORY_ABI, ISLAND_ABI, POOL_ABI, TOKEN_INFO_ABI } from './abi';
import { fetchVaultByAddress, fetchVaultsFromSubgraph, mapSubgraphDataToIslands } from './subgraph';

// Contract address for Kodiak on mainnet
const FACTORY_ADDRESS = '0xc7a3f400ae22b05c7bfdb7bbc7a3be5d1777fd50';
const KODIAK_API_BASE_URL = 'https://backend.kodiak.finance';

// Get token information from an ERC20 token
async function getTokenInfo(tokenAddress: string, provider: ethers.JsonRpcProvider): Promise<{
  address: string;
  decimals: number;
  symbol?: string;
}> {
  const tokenContract = new ethers.Contract(tokenAddress, TOKEN_INFO_ABI, provider);
  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  
  return {
    address: tokenAddress,
    decimals: Number(decimals),
    symbol
  };
}

/**
 * Fetches data for a specific Kodiak Island
 */
export async function getIslandDetails(address: string): Promise<KodiakIsland | null> {
  console.log(`Fetching data for Kodiak Island ${address}...`);

  try {
    // First try to get data from subgraph (more efficient and includes real APR)
    const subgraphData = await fetchVaultByAddress(address);

    if (subgraphData) {
      console.log(`Successfully fetched data from subgraph for Island ${address}`);
      return mapSubgraphDataToIslands([subgraphData])[0];
    }

    console.log(`Subgraph data not available for ${address}, falling back to on-chain data...`);

    // Fall back to on-chain data if subgraph fails
    const provider = new ethers.JsonRpcProvider(berachainConfig.rpcUrl);

    // Create Island contract instance
    const island = new ethers.Contract(address, ISLAND_ABI, provider);

    // Get token addresses directly from the island contract
    const token0Address = await island.token0();
    const token1Address = await island.token1();

    // Get pool address (for fee tier)
    const poolAddress = await island.pool();

    // Get token details using the helper function
    const token0 = await getTokenInfo(token0Address, provider);
    const token1 = await getTokenInfo(token1Address, provider);

    // Get name directly from the island contract or construct it
    let name;
    try {
      name = await island.name();
    } catch (error) {
      // Fall back to constructed name if name() function fails
      name = `Kodiak Island ${token0.symbol || 'Token0'}-${token1.symbol || 'Token1'}`;
    }

    // Get Island config
    const lowerTick = await island.lowerTick();
    const upperTick = await island.upperTick();
    const manager = await island.manager();

    // Check if island is managed
    const isManaged = await island.isManaged();

    // Get manager fee if managed
    let managerFeeBPS = 0;
    if (isManaged) {
      managerFeeBPS = await island.managerFeeBPS();
    }

    // Get pool fee tier and current tick
    let feeTier = 0; // Default to 0 if not available
    let tick: number | undefined = undefined;
    try {
      const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
      feeTier = Number(await pool.fee());
      
      // Get current tick from pool slot0
      const slot0 = await pool.slot0();
      tick = Number(slot0.tick);
    } catch (error) {
      console.error(`Error fetching pool data for island ${address}: ${error}`);
      // Continue with defaults if pool data can't be fetched
    }

    // Get balances
    const balances = await island.getUnderlyingBalances();
    const totalSupply = (await island.totalSupply()).toString();

    return buildKodiakIslandObject(
      address,
      name,
      token0,
      token1,
      totalSupply,
      Number(lowerTick),
      Number(upperTick),
      Number(feeTier),
      manager,
      isManaged,
      Number(managerFeeBPS),
      balances,
      tick
    );
  } catch (error) {
    console.error(`Error fetching Island data: ${error}`);
    return null;
  }
}

/**
 * Fetches all Kodiak Islands from the factory
 */
export async function fetchKodiakIslands(): Promise<KodiakIslandResponse> {
  try {
    console.log('Fetching Kodiak Islands...');

    // Try to get data from subgraph first (more efficient and includes real APR)
    try {
      console.log('Trying to fetch data from subgraph...');
      const vaults = await fetchVaultsFromSubgraph();

      if (vaults.length > 0) {
        const islands = mapSubgraphDataToIslands(vaults);
        console.log(`Successfully fetched ${islands.length} islands from subgraph`);

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
      }
    } catch (error) {
      console.warn(`Failed to fetch data from subgraph: ${error}. Falling back to on-chain data.`);
    }

    console.log('Falling back to on-chain data...');

    // Fall back to on-chain data if subgraph fails
    const provider = new ethers.JsonRpcProvider(berachainConfig.rpcUrl);

    // Create factory contract instance
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

    // Get number of islands and deployers
    const numIslands = await factory.numIslands();
    console.log(`Found ${numIslands} total islands on factory`);

    // Get all deployers
    const deployers = await factory.getDeployers();
    console.log(`Found ${deployers.length} deployers on factory`);

    const islands: KodiakIsland[] = [];
    const tokenPairs = new Set();

    const deployerPromises = deployers.map(async (deployer: string) => {
      try {
        const deployerIslands = await factory.getIslands(deployer);
        console.log(`Deployer ${deployer} has ${deployerIslands.length} islands`);

        const islandPromises = deployerIslands.map(async (islandAddress: string) => {
          try {
            return await getIslandDetails(islandAddress);
          } catch (error) {
            console.error(`Error fetching island ${islandAddress}: ${error}`);
            return null;
          }
        });

        const islandResults = await Promise.all(islandPromises);
        return islandResults.filter(island => island !== null);
      } catch (error) {
        console.error(`Error fetching islands for deployer ${deployer}: ${error}`);
        return [];
      }
    });

    const deployerResults = await Promise.all(deployerPromises);
    const allIslandData = deployerResults.flat();

    // Add islands and token pairs
    for (const islandData of allIslandData) {
      islands.push(islandData);
      tokenPairs.add(`${islandData.token0.symbol}-${islandData.token1.symbol}`);
    }

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
    console.error(`Error fetching Kodiak Islands: ${error}`);
    return {
      success: false,
      error: `Failed to fetch Kodiak Islands: ${error}`
    };
  }
}

/**
 * Gets all available Kodiak investment opportunities
 * @param options Filter options
 * @returns Array of Kodiak Islands that meet the filter criteria
 */
export async function getKodiakOpportunities(
  options: {
    minTvl?: number;
    includeInactive?: boolean;
    minVolumeUSD?: number;
  } = {}
): Promise<KodiakIsland[]> {
  // Set default options
  const {
    minTvl = 100, // Default minimum TVL to filter out dust positions
    includeInactive = false, // By default, filter out inactive islands
    minVolumeUSD = 0 // Default minimum volume
  } = options;

  try {
    // Fetch all islands
    const islandsResponse = await fetchKodiakIslands();

    if (!islandsResponse.success || !islandsResponse.data) {
      throw new Error(islandsResponse.error || 'Failed to fetch islands');
    }

    let islands = islandsResponse.data.islands;

    // Apply filters to get active islands
    const activeIslands = islands.filter(island => {
      // Filter 1: Minimum TVL threshold
      if (island.tvl.usdValue < minTvl) {
        return false;
      }

      // Filter 2: Minimum volume threshold (if specified)
      if (minVolumeUSD > 0 && parseFloat(island.volumeUSD || '0') < minVolumeUSD) {
        return false;
      }

      // Filter 3: Check for inactive islands (with zero token amounts)
      if (!includeInactive) {
        const token0Amount = ethers.toBigInt(island.tvl.token0Amount);
        const token1Amount = ethers.toBigInt(island.tvl.token1Amount);

        // Skip islands with no tokens
        if (token0Amount === BigInt(0) && token1Amount === BigInt(0)) {
          return false;
        }

        // Skip islands with zero APR and low TVL (likely inactive)
        if (island.apr.feeApr === 0 && island.tvl.usdValue < 5000) {
          return false;
        }
      }

      return true;
    });

    console.log(`Found ${activeIslands.length} active Kodiak Islands`);
    return activeIslands;
  } catch (error) {
    console.error('Error getting Kodiak opportunities:', error);
    return [];
  }
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
    
    const apiVaults = response.data.data;
    console.log(`Successfully fetched ${apiVaults.length} islands from API`);
    
    // Check for baults in the response
    const vaultsWithBaults = apiVaults.filter(vault => vault.baults && vault.baults.length > 0);
    if (vaultsWithBaults.length > 0) {
      console.log(`Found ${vaultsWithBaults.length} islands with active baults`);
    }
    
    // Map the API response to our format
    const islands = mapApiResponseToIslands(apiVaults);
    
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
  // First, filter out vaults where either token has a zero price
  const filteredVaults = apiVaults.filter(vault => {
    if (vault.token0.price === 0) {
      console.log(`Filtering out island ${vault.id} (${vault.token0.symbol}-${vault.token1.symbol}) because token0 price is 0`);
      return false;
    }
    if (vault.token1.price === 0) {
      console.log(`Filtering out island ${vault.id} (${vault.token0.symbol}-${vault.token1.symbol}) because token1 price is 0`);
      return false;
    }
    return true;
  });
  
  // Then map the filtered vaults to our format
  return filteredVaults.map(vault => {
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
      tick: vault.currentTick,
      // Add baults data if available
      baults: vault.baults
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
    filterBaults?: 'only' | 'exclude' | 'include'; // 'only' shows only islands with baults, 'exclude' hides islands with baults, 'include' shows all
  } = {}
): Promise<KodiakIsland[]> {
  // Set default options
  const {
    minTvl = 100, // Default minimum TVL
    includeInactive = false, // By default, filter out inactive islands
    chainId = 80094, // Default to BERA Mainnet
    filterBaults = 'include' // By default, include all islands regardless of baults status
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
    const filteredIslands = islands.filter(island => {
      // Filter out inactive islands if specified
      if (!includeInactive) {
        // Consider an island inactive if both APRs are zero
        if (island.apr.feeApr === 0 && island.apr.combinedApr === 0) {
          return false;
        }
      }
      
      // Filter by baults
      if (filterBaults === 'only') {
        // Only show islands with active baults
        return island.baults && island.baults.length > 0;
      } else if (filterBaults === 'exclude') {
        // Exclude islands with baults
        return !island.baults || island.baults.length === 0;
      }
      
      return true;
    });
    
    console.log(`Found ${filteredIslands.length} active Kodiak Islands from API`);
    return filteredIslands;
  } catch (error) {
    console.error('Error getting Kodiak opportunities from API:', error);
    return [];
  }
}

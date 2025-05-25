import { ethers } from 'ethers';
import { BerachainMainnetConfig } from '../config/network';
import { KodiakIsland, KodiakIslandResponse, buildKodiakIslandObject } from '../types/kodiak';
import { FACTORY_ABI, ISLAND_ABI, POOL_ABI, TOKEN_INFO_ABI } from './abi';
import { fetchVaultByAddress, fetchVaultsFromSubgraph, mapSubgraphDataToIslands } from './subgraph';

// Contract address for Kodiak on mainnet
const FACTORY_ADDRESS = '0xc7a3f400ae22b05c7bfdb7bbc7a3be5d1777fd50';

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
    const provider = new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl);

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
    const provider = new ethers.JsonRpcProvider(BerachainMainnetConfig.rpcUrl);

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

    // Loop through each deployer and get their islands
    for (const deployer of deployers) {
      try {
        const deployerIslands = await factory.getIslands(deployer);
        console.log(`Deployer ${deployer} has ${deployerIslands.length} islands`);

        // Process each island from this deployer
        for (const islandAddress of deployerIslands) {
          try {
            const islandData = await getIslandDetails(islandAddress);

            if (islandData) {
              islands.push(islandData);
              tokenPairs.add(`${islandData.token0.symbol}-${islandData.token1.symbol}`);
            }
          } catch (error) {
            console.error(`Error fetching island ${islandAddress}: ${error}`);
          }
        }
      } catch (error) {
        console.error(`Error fetching islands for deployer ${deployer}: ${error}`);
      }
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
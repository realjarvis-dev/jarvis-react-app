import { ethers } from 'ethers';
import { BepoliaConfig, BerachainMainnetConfig } from '../config/network';
import { KodiakIsland, KodiakIslandResponse } from '../types/kodiak';
import { fetchVaultByAddress, fetchVaultsFromSubgraph, mapSubgraphDataToIslands } from './subgraph';

// ABIs for interacting with Kodiak contracts - defined inline to avoid external files
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)'
];

const POOL_ABI = [
  'function fee() view returns (uint24)'
];

const ISLAND_ABI = [
  'function name() view returns (string)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function lowerTick() view returns (int24)',
  'function upperTick() view returns (int24)',
  'function pool() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function manager() view returns (address)',
  'function isManaged() view returns (bool)',
  'function managerFeeBPS() view returns (uint16)',
  'function getUnderlyingBalances() view returns (uint256 amount0Current, uint256 amount1Current)'
];

const FACTORY_ABI = [
  'function numIslands() view returns (uint256)',
  'function getDeployers() view returns (address[])',
  'function getIslands(address deployer) view returns (address[])'
];

// Contract addresses for Kodiak on different networks
const CONTRACT_ADDRESSES = {
  bepolia: {
    factory: '0x85F42bf3aDC6F9ED718a26e3CC64af73B756812e'
  },
  mainnet: {
    factory: '0xc7a3f400ae22b05c7bfdb7bbc7a3be5d1777fd50'
  }
};

/**
 * Fetches data for a specific Kodiak Island
 */
export async function getIslandData(
  address: string,
  network: 'bepolia' | 'mainnet' = 'bepolia'
): Promise<KodiakIsland | null> {
  console.log(`Fetching data for Kodiak Island ${address} on ${network}...`);
  
  try {
    // First try to get data from subgraph (more efficient and includes real APR)
    const subgraphData = await fetchVaultByAddress(address, network);
    
    if (subgraphData) {
      console.log(`Successfully fetched data from ${network} subgraph for Island ${address}`);
      return mapSubgraphDataToIslands([subgraphData])[0];
    }
    
    console.log(`Subgraph data not available for ${address}, falling back to on-chain data...`);
    
    // Fall back to on-chain data if subgraph fails
    const config = network === 'bepolia' ? BepoliaConfig : BerachainMainnetConfig;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Create Island contract instance
    const island = new ethers.Contract(address, ISLAND_ABI, provider);
    
    // Get token addresses directly from the island contract
    const token0Address = await island.token0();
    const token1Address = await island.token1();
    
    // Get pool address (for fee tier)
    const poolAddress = await island.pool();
    
    // Get token details
    const token0 = new ethers.Contract(token0Address, ERC20_ABI, provider);
    const token1 = new ethers.Contract(token1Address, ERC20_ABI, provider);
    
    const token0Symbol = await token0.symbol();
    const token1Symbol = await token1.symbol();
    const token0Decimals = await token0.decimals();
    const token1Decimals = await token1.decimals();
    
    // Get name directly from the island contract or construct it
    let name;
    try {
      name = await island.name();
    } catch (error) {
      // Fall back to constructed name if name() function fails
      name = `Kodiak Island ${token0Symbol}-${token1Symbol}`;
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
    
    // Get pool fee tier
    let feeTier;
    try {
      const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
      feeTier = await pool.fee();
    } catch (error) {
      feeTier = 3000; // Default to 0.3%
    }
    
    // Get balances
    const balances = await island.getUnderlyingBalances();
    
    return {
      address,
      name,
      token0: {
        address: token0Address,
        symbol: token0Symbol,
        decimals: token0Decimals
      },
      token1: {
        address: token1Address,
        symbol: token1Symbol,
        decimals: token1Decimals
      },
      totalSupply: (await island.totalSupply()).toString(),
      lowerTick: Number(lowerTick),
      upperTick: Number(upperTick),
      feeTier: Number(feeTier),
      manager,
      isManaged,
      managerFeeBPS: Number(managerFeeBPS),
      tvl: {
        token0Amount: balances[0].toString(),
        token1Amount: balances[1].toString(),
        usdValue: 0 // Can't determine USD value from on-chain data
      },
      apr: {
        feeApr: 0,
        combinedApr: 0,
        isEstimate: true // On-chain data doesn't provide APR information
      }
    };
  } catch (error) {
    console.error(`Error fetching Island data: ${error}`);
    return null;
  }
}

/**
 * Fetches all Kodiak Islands from the factory
 */
export async function fetchKodiakIslands(
  network: 'bepolia' | 'mainnet' = 'bepolia'
): Promise<KodiakIslandResponse> {
  try {
    console.log(`Fetching Kodiak Islands from ${network}...`);
    
    // Try to get data from subgraph first (more efficient and includes real APR)
    try {
      console.log(`Trying to fetch data from ${network} subgraph...`);
      const vaults = await fetchVaultsFromSubgraph(network);
      
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
              networks: [network]
            }
          }
        };
      }
    } catch (error) {
      console.warn(`Failed to fetch data from subgraph: ${error}. Falling back to on-chain data.`);
    }
    
    console.log(`Falling back to on-chain data for ${network}...`);
    
    // Fall back to on-chain data if subgraph fails
    const config = network === 'bepolia' ? BepoliaConfig : BerachainMainnetConfig;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Create factory contract instance
    const factoryAddress = CONTRACT_ADDRESSES[network].factory;
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
    
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
            const islandData = await getIslandData(islandAddress, network);
            
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
          networks: [network]
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
 * @param network Network to query
 * @param options Filter options
 * @returns Array of Kodiak Islands that meet the filter criteria
 */
export async function getKodiakOpportunities(
  network: 'bepolia' | 'mainnet' = 'bepolia',
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
    const islandsResponse = await fetchKodiakIslands(network);
    
    if (!islandsResponse.success || !islandsResponse.data) {
      throw new Error(islandsResponse.error || 'Failed to fetch islands');
    }
    
    let islands = islandsResponse.data.islands;
    
    // Only apply filters on mainnet, not on testnet
    if (network === 'mainnet') {
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
      
      console.log(`Found ${activeIslands.length} active Kodiak Islands on mainnet`);
      return activeIslands;
    } else {
      // On testnet, return all islands without filtering
      console.log(`Found ${islands.length} Kodiak Islands on testnet (no filtering applied)`);
      return islands;
    }
  } catch (error) {
    console.error('Error getting Kodiak opportunities:', error);
    return [];
  }
}

/**
 * Gets a specific Kodiak Island by address
 */
export async function getKodiakIslandByAddress(
  address: string,
  network: 'bepolia' | 'mainnet' = 'bepolia'
): Promise<KodiakIsland | null> {
  try {
    return await getIslandData(address, network);
  } catch (error: any) {
    console.error(`Error getting Kodiak Island ${address}: ${error.message}`);
    return null;
  }
} 
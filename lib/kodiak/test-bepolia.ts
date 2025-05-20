/**
 * Test script for Kodiak Islands on Berachain Bepolia testnet
 * Run with: bun lib/kodiak/test-bepolia.ts
 */

import { ethers } from 'ethers';
import { BepoliaConfig } from '../config/network';
import { fetchKodiakIslands, getKodiakIslandByAddress } from './api';

// Factory contract
const FACTORY_ADDRESS = '0x85F42bf3aDC6F9ED718a26e3CC64af73B756812e';
const FACTORY_ABI = [
  'function numIslands() view returns (uint256)',
  'function getDeployers() view returns (address[])',
  'function getIslands(address deployer) view returns (address[])'
];

async function testBepoliaIslands() {
  console.log('Testing Kodiak Islands on Berachain Bepolia testnet...');
  
  // Set up provider
  const provider = new ethers.JsonRpcProvider(BepoliaConfig.rpcUrl);
  console.log(`Connected to Bepolia testnet at ${BepoliaConfig.rpcUrl}`);
  
  // Create factory contract instance
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  
  try {
    // Get total number of islands
    const numIslands = await factory.numIslands();
    console.log(`Total islands on factory: ${numIslands}`);
    
    // Get all deployers
    const deployers = await factory.getDeployers();
    console.log(`Number of deployers: ${deployers.length}`);
    
    // Print deployers
    console.log('Deployer addresses:');
    for (const deployer of deployers) {
      console.log(`- ${deployer}`);
      
      // Get islands for this deployer
      const deployerIslands = await factory.getIslands(deployer);
      console.log(`  Has ${deployerIslands.length} islands`);
      
      if (deployerIslands.length > 0) {
        // Get details for the first island
        const firstIsland = deployerIslands[0];
        console.log(`  First island address: ${firstIsland}`);
        
        // Fetch detailed data for this island
        const islandData = await getKodiakIslandByAddress(firstIsland, 'bepolia');
        if (islandData) {
          console.log(`  Island name: ${islandData.name}`);
          console.log(`  Token pair: ${islandData.token0.symbol}-${islandData.token1.symbol}`);
          console.log(`  TVL: ${islandData.tvl.token0Amount} ${islandData.token0.symbol}, ${islandData.tvl.token1Amount} ${islandData.token1.symbol}`);
        }
      }
    }
    
    // Try to fetch all islands using the main function
    console.log('\nFetching all islands using fetchKodiakIslands...');
    const response = await fetchKodiakIslands('bepolia');
    
    if (response.success && response.data) {
      console.log(`Found ${response.data.islands.length} islands`);
      console.log(`Unique token pairs: ${response.data.stats.uniquePairs}`);
      
      // Print token pairs
      if (response.data.islands.length > 0) {
        console.log('\nToken pairs:');
        const pairs = new Set();
        response.data.islands.forEach(island => {
          const pair = `${island.token0.symbol}-${island.token1.symbol}`;
          pairs.add(pair);
        });
        
        for (const pair of pairs) {
          console.log(`- ${pair}`);
        }
      }
    } else {
      console.error('Failed to fetch islands:', response.error);
    }
  } catch (error) {
    console.error('Error testing Bepolia islands:', error);
  }
}

// Run the test
testBepoliaIslands().then(() => console.log('Done.')); 
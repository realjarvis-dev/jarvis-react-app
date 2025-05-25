import { getKodiakOpportunitiesFromApi } from '../api_endpoint';

/**
 * Test function to verify the API endpoint integration
 */
async function main() {
  try {
    console.log('Testing Kodiak API endpoint integration...');
    
    // Fetch Kodiak opportunities from the API
    const islands = await getKodiakOpportunitiesFromApi({
      minTvl: 100000, // Set a higher threshold to get fewer results
    });
    
    console.log(`Successfully fetched ${islands.length} islands from API`);
    
    if (islands.length > 0) {
      // Print raw JSON of the first island for debugging
      console.log('\n===== First Island Raw JSON =====');
      console.log(JSON.stringify(islands[0], null, 2));
      
      // Print information about the first island
      const firstIsland = islands[0];
      
      console.log('\n===== First Island Details =====');
      console.log(`Address: ${firstIsland.address}`);
      console.log(`Name: ${firstIsland.name}`);
      console.log(`Pair: ${firstIsland.token0.symbol}-${firstIsland.token1.symbol}`);
      console.log(`Fee Tier: ${firstIsland.feeTier / 10000}%`);
      
      console.log('\n===== Price Range =====');
      console.log(`Lower Tick: ${firstIsland.lowerTick}`);
      console.log(`Upper Tick: ${firstIsland.upperTick}`);
      console.log(`Current Tick: ${firstIsland.tick}`);
      
      console.log('\n===== TVL Information =====');
      console.log(`Total Value Locked: $${firstIsland.tvl.usdValue.toLocaleString()}`);
      console.log(`Token0 (${firstIsland.token0.symbol}): ${parseFloat(firstIsland.tvl.token0Amount).toLocaleString()}`);
      console.log(`Token1 (${firstIsland.token1.symbol}): ${parseFloat(firstIsland.tvl.token1Amount).toLocaleString()}`);
      
      console.log('\n===== APR Information =====');
      console.log(`Base APR: ${(firstIsland.apr.feeApr * 100).toFixed(2)}%`);
      console.log(`Reward APR: ${((firstIsland.apr.rewardApr || 0) * 100).toFixed(2)}%`);
      console.log(`Combined APR: ${(firstIsland.apr.combinedApr * 100).toFixed(2)}%`);
      
      console.log('\n===== Additional Information =====');
      console.log(`Weekly Volume: $${parseFloat(firstIsland.weeklyVolumeUSD || '0').toLocaleString()}`);
      console.log(`Is Managed: ${firstIsland.isManaged ? 'Yes' : 'No'}`);
      if (firstIsland.isManaged) {
        console.log(`Manager: ${firstIsland.manager}`);
      }
      
      // List all islands with their combined APR
      console.log('\n===== All Islands =====');
      islands.forEach((island, index) => {
        console.log(`${index + 1}. ${island.name}: ${(island.apr.combinedApr * 100).toFixed(2)}% APR | $${island.tvl.usdValue.toLocaleString()} TVL`);
      });
    } else {
      console.log('No islands found. Check your filter criteria or API connection.');
    }
  } catch (error) {
    console.error('Error running test script:', error);
  }
}

// Run the test
main(); 
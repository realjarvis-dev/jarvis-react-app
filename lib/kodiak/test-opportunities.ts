/**
 * Simplified test script that displays all active Kodiak Islands opportunities
 * Run with: bun lib/kodiak/test-opportunities.ts
 */

import { getKodiakOpportunities } from './api';
import { formatAPR, formatPriceRange, formatTVL } from './utils';

/**
 * Format the current price for display
 */
function formatCurrentPrice(island: any): string {
  if (!island.currentPrice) return 'N/A';
  
  return `${island.currentPrice.toFixed(6)} ${island.token1.symbol}`;
}

/**
 * Display opportunity in a format similar to Kodiak UI
 */
function displayOpportunityTable(islands: any[]) {
  // Sort by APR
  const sortedIslands = [...islands].sort((a, b) => b.apr.feeApr - a.apr.feeApr);
  
  // Print headers
  console.log('Pool'.padEnd(25) + 'Range'.padEnd(40) + 'Price'.padEnd(25) + 'Pool TVL'.padEnd(15) + 'APR');
  console.log('-'.repeat(115));
  
  // Print each island
  sortedIslands.forEach(island => {
    // Format pool name
    const poolName = `${island.token0.symbol} - ${island.token1.symbol}`;
    const feeTier = (island.feeTier / 10000).toFixed(1) + '%';
    const poolType = 'Island';
    
    const pool = `${poolName.padEnd(20)} ${feeTier.padEnd(4)} ${poolType}`;
    
    // Format price range (Min/Max values)
    const min = `Min: ${island.token0.symbol} 1 = ${formatTickToPrice(island.lowerTick, island.token0.decimals, island.token1.decimals).toFixed(4)}`;
    const max = `Max: ${island.token0.symbol} 1 = ${formatTickToPrice(island.upperTick, island.token0.decimals, island.token1.decimals).toFixed(4)}`;
    const range = `${min}\n${' '.repeat(25)}${max}`;
    
    // Current price
    const price = `${island.token0.symbol} 1 = ${formatCurrentPrice(island)}`;
    
    // TVL
    const tvl = `$${island.tvl.usdValue.toLocaleString('en-US', {
      maximumFractionDigits: 0
    })}`;
    
    // APR - add blue/green color coding like in the screenshot
    const aprValue = (island.apr.feeApr * 100).toFixed(2);
    // Using simple Unicode for arrow, could be replaced with proper terminal colors
    const apr = `${aprValue}%`;
    
    console.log(pool.padEnd(25) + range.padEnd(40) + price.padEnd(25) + tvl.padEnd(15) + apr);
  });
}

/**
 * Convert tick to price
 */
function formatTickToPrice(tick: number, decimals0: number, decimals1: number): number {
  const tickToPrice = Math.pow(1.0001, tick);
  return tickToPrice * Math.pow(10, decimals0 - decimals1);
}

/**
 * Display detailed information about an opportunity
 */
function displayOpportunityDetails(island: any) {
  console.log(`\nDetailed information for ${island.token0.symbol}-${island.token1.symbol}:`);
  console.log(`Address: ${island.address}`);
  console.log(`Type: Island`);
  console.log(`Fee Tier: ${island.feeTier / 10000}%`);
  console.log(`Price Range: ${formatPriceRange(
    island.lowerTick,
    island.upperTick,
    island.token0.symbol,
    island.token1.symbol
  )}`);
  console.log(`Current Price: ${island.token0.symbol} 1 = ${formatCurrentPrice(island)}`);
  console.log(`TVL: ${formatTVL(
    island.tvl.token0Amount,
    island.tvl.token1Amount,
    island.token0.decimals,
    island.token1.decimals,
    island.token0.symbol,
    island.token1.symbol
  )}`);
  console.log(`TVL (USD): $${island.tvl.usdValue.toLocaleString()}`);
  console.log(`APR: ${formatAPR(island.apr.feeApr, island.apr.isEstimate)}`);
  console.log(`Volume (All Time): $${parseFloat(island.volumeUSD || '0').toLocaleString()}`);
  console.log(`Volume (Weekly): $${parseFloat(island.weeklyVolumeUSD || '0').toLocaleString()}`);
  console.log(`Managed: ${island.isManaged ? 'Yes' : 'No'}`);
  if (island.isManaged) {
    console.log(`Manager: ${island.manager}`);
    console.log(`Manager Fee: ${island.managerFeeBPS / 100}%`);
  }
}

/**
 * Fetch and display active opportunities
 */
async function showActiveOpportunities() {
  console.log('Fetching active Kodiak Islands opportunities...\n');
  
  try {
    // Get all active opportunities with default filtering (TVL >= $100)
    const activeIslands = await getKodiakOpportunities('bepolia');
    
    console.log(`Found ${activeIslands.length} active Kodiak Islands\n`);
    
    // Display in table format
    displayOpportunityTable(activeIslands);
    
    // Show detailed info for the top 3 APR islands
    const topAprIslands = [...activeIslands].sort((a, b) => b.apr.feeApr - a.apr.feeApr).slice(0, 3);
    
    console.log('\n=== Top 3 Islands by APR ===');
    topAprIslands.forEach(island => displayOpportunityDetails(island));
    
  } catch (error: any) {
    console.error('Error fetching opportunities:', error.message);
  }
}

// Run the script
showActiveOpportunities().then(() => console.log('\nDone.')); 
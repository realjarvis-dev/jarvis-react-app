import { getGasPriceByChainId } from '../lib/blocknative/get-gas-price'
import { getTokenUsdPriceBatch } from '../lib/enso/get-token-usd-price'
import { morphoAPI } from '../lib/morpho/api'
import { getPendleMarkets } from '../lib/pendle/api'
import {
  runPtLoopingSimulation,
  SimulationParams
} from '../lib/simulation/pt-looping-simulation'
import { formatUnits } from 'viem'

// --- Simulation Configuration ---
const CONFIG = {
  chainId: 1, // 1 for Ethereum, 8453 for Base
  ptIdentifier: 'sUSDe', // A substring to identify the desired Pendle market
  initialUsdc: 10000,
  leverageTarget: 5,
  buffer: 0.1, // 5% safety buffer from liquidation LTV
  slippageBuy: 0.002, // 0.2%
  slippageSell: 0.003, // 0.3%
  gasUnitsPerLoop: 650000 // Estimated gas for: Buy PT -> Deposit -> Borrow
}

async function main() {
  console.log('--- Running Realistic PT Looping Simulation ---')

  // 1. Fetch Pendle Market Data
  console.log(`Fetching Pendle market data for "${CONFIG.ptIdentifier}"...`)
  const allMarkets = await getPendleMarkets('active', CONFIG.chainId)
  const allTargetMarket = allMarkets.filter(m => m.name.includes(CONFIG.ptIdentifier))
//   console.log(allTargetMarket)
//   const targetMarket = allMarkets.find(m =>
//     m.name.includes(CONFIG.ptIdentifier)
//   )
  const targetMarket = allTargetMarket[allTargetMarket.length - 1]

  if (!targetMarket) {
    console.error(
      `Error: Could not find a Pendle market with identifier "${CONFIG.ptIdentifier}" on chain ${CONFIG.chainId}.`
    )
    return
  }

  const ptApy = targetMarket.impliedApy
  const daysToExpiry = Math.ceil(
    (new Date(targetMarket.expiry).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24)
  )
  console.log(`Found PT Market: ${targetMarket.name}`)
  console.log(`  - PT APY: ${(ptApy * 100).toFixed(2)}%`)
  console.log(`  - Days to Expiry: ${daysToExpiry}`)

  // 2. Fetch Morpho Market Data
  console.log('Fetching Morpho market data...')
  const borrowingRates = await morphoAPI.getPTTokenBorrowingRates(
    [targetMarket.pt],
    [CONFIG.chainId]
  )
  const morphoMarket = borrowingRates.length > 0 ? borrowingRates[0] : undefined

  if (!morphoMarket) {
    console.error(
      `Error: Could not find a corresponding Morpho market for PT ${targetMarket.pt}.`
    )
    return
  }

  const borrowApy = morphoMarket.borrowApy
  const lltv = morphoMarket.maxLtv
  console.log(`Found Morpho Market:`)
  console.log(`  - Borrow APY: ${(borrowApy * 100).toFixed(2)}%`)
  console.log(`  - Max LTV (LLTV): ${(lltv * 100).toFixed(2)}%`)

  // 3. Fetch Gas and ETH Price
  console.log('Fetching real-time gas and ETH price...')
  const gasPriceGwei = await getGasPriceByChainId(CONFIG.chainId)
  const ethPrice = await getTokenUsdPriceBatch(['0x0000000000000000000000000000000000000000'], CONFIG.chainId)
  console.log(`  - Gas Price: ${formatUnits(gasPriceGwei.maxFeePerGas, 9)} Gwei`)
  console.log(`  - ETH Price: $${ethPrice[0].price}`)

  // 4. Determine Number of Loops for Target Leverage
  const targetLtv = lltv - CONFIG.buffer
  const loops = Math.round(
    Math.log(1 - CONFIG.leverageTarget * (1 - targetLtv)) / Math.log(targetLtv)
  )

  // 5. Assemble Simulation Parameters
  const params: SimulationParams = {
    initialUsdc: CONFIG.initialUsdc,
    loops,
    lltv,
    buffer: CONFIG.buffer,
    ptApy,
    borrowApy,
    slippageBuy: CONFIG.slippageBuy,
    slippageSell: CONFIG.slippageSell,
    gasUnitsPerLoop: CONFIG.gasUnitsPerLoop,
    gasPriceGwei: Number(formatUnits(gasPriceGwei.maxFeePerGas, 9)),
    ethPriceUsd: ethPrice[0].price,
    horizonDays: daysToExpiry
  }

  // 6. Run Simulation
  console.log('\n--- Starting Simulation ---')
  const { rows, summary } = runPtLoopingSimulation(params)

  // 7. Display Results
  console.log('Simulation Results:')
  console.table(
    rows.map(r => ({
      Loop: r.loop,
      'Collateral (USD)': r.collateralValue.toFixed(2),
      'Debt (USD)': r.debt.toFixed(2),
      LTV: (r.ltv * 100).toFixed(2) + '%',
      'Gas Cost (USD)': r.gasSpentUsd.toFixed(2)
    }))
  )

  console.log('\n--- Simulation Summary ---')
  console.log(`Initial Investment: $${summary.initialUsdc.toFixed(2)}`)
  console.log(
    `Leverage Achieved: ${summary.leverage.toFixed(2)}x over ${
      summary.loops
    } loops`
  )
  console.log(
    `Target LTV: ${(summary.targetLtv * 100).toFixed(2)}% (LLTV: ${(
      lltv * 100
    ).toFixed(2)}%, Buffer: ${(CONFIG.buffer * 100).toFixed(2)}%)`
  )
  console.log(`---`)
  console.log(
    `Gross PnL (pre-gas): $${(summary.pnlUsd + summary.totalGasSpent).toFixed(
      2
    )}`
  )
  console.log(`Total Gas Cost: $${summary.totalGasSpent.toFixed(2)}`)
  console.log(`Net PnL (after gas): $${summary.pnlUsd.toFixed(2)}`)
  console.log(`---`)
  console.log(`Final Net APY: ${(summary.apr * 100).toFixed(2)}%`)
  console.log('--------------------------')
}

main().catch(console.error)

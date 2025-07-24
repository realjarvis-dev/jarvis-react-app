import { getGasPriceByChainId } from '../lib/blocknative/get-gas-price'
import { getTokenUsdPriceBatch } from '../lib/enso/get-token-usd-price'
import { morphoAPI } from '../lib/morpho/api'
import { getPendleMarkets } from '../lib/pendle/api'
import {
  runPtLoopingSimulation,
  SimulationParams
} from '../lib/simulation/pt-looping-simulation'
import { createPublicClient, http, formatUnits, parseAbi, zeroAddress } from 'viem'
import { mainnet } from 'viem/chains'

// --- Morpho Blue Configuration ---
const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'
const MORPHO_BLUE_ABI = parseAbi([
  'function supply(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv, uint256 assets, address onBehalf, bytes calldata data) external returns (uint256, uint256)',
  'function borrow(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv, uint256 shares, address to, bytes calldata data) external returns (uint256, uint256)',
  'function repay(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256, uint256)',
  'function withdraw(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv, uint256 shares, address to, bytes calldata data) external returns (uint256, uint256)'
])

// --- Simulation Configuration ---
const CONFIG = {
  chainId: 1, // 1 for Ethereum, 8453 for Base
  ptIdentifier: 'sUSDe', // A substring to identify the desired Pendle market
  initialUsdc: 100000,
  buffer: 0.1, // 10% safety buffer from liquidation LTV
  slippageBuy: 0.0004, // 0.04%
  slippageSell: 0.0005, // 0.05%
  gasUnitsPerLoop: 0, // This will be calculated
  gasUnitsForUnwind: 0 // This will be calculated
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
  const targetMarket = allTargetMarket[allTargetMarket.length - 1] // need to change it to the last item when you are looking for the furthers market

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


  const fullMorphoMarket = await morphoAPI.getMarketByKey(morphoMarket.marketKey)
  if (!fullMorphoMarket) {
    throw new Error('Could not fetch full morpho market details')
  }

  // We can't estimate gas for the swap without a quote, so we'll use a placeholder
  const gasBuyPt = (357_409 + 581_948 + 350_084 + 559_090 + 458_034) * (1 / 5) // Placeholder for Buy PT gas
  const gasSellPt = gasBuyPt // Placeholder for Sell PT gas

  const gasDeposit = (70_894 + 53_794 + 98_409) * (1 / 3)


  const gasBorrow = (114_314 + 132_505 +  131_245) * (1 / 3)

  const gasRepay = (98_639 + 98_615 + 98_603) * (1 / 3)

  const gasWithdraw = (106_560 + 170_629 + 170_629) * (1 / 3)

  CONFIG.gasUnitsPerLoop = gasBuyPt + Number(gasDeposit) + Number(gasBorrow)
  CONFIG.gasUnitsForUnwind = Number(gasRepay) + Number(gasWithdraw) + gasSellPt

  console.log('  - Gas for one loop (Buy PT -> Deposit -> Borrow):', CONFIG.gasUnitsPerLoop)
  console.log('  - Gas for unwind (Repay -> Withdraw -> Sell PT):', CONFIG.gasUnitsForUnwind)


  // 4. Fetch Gas and ETH Price
  console.log('Fetching real-time gas and ETH price...')
  const gasPriceGwei = await getGasPriceByChainId(CONFIG.chainId)
  const ethPrice = await getTokenUsdPriceBatch(['0x0000000000000000000000000000000000000000'], CONFIG.chainId)
  console.log(`  - Gas Price: ${formatUnits(gasPriceGwei.maxFeePerGas, 9)} Gwei`)
  console.log(`  - ETH Price: $${ethPrice[0].price}`)

  const targetLtv = lltv - CONFIG.buffer

  for (let leverageTarget = 1; leverageTarget <= 4; leverageTarget++) {
    // 5. Determine Number of Loops for Target Leverage
    console.log(
      `\n\n--- Running Simulation for Leverage Target: ${leverageTarget}x ---`
    )

    // Check if leverage is possible
    if (leverageTarget > 1 && leverageTarget * (1 - targetLtv) >= 1) {
      console.log(
        `Leverage target ${leverageTarget}x is not achievable with a target LTV of ${(
          targetLtv * 100
        ).toFixed(2)}%. Maximum possible leverage is approx ${(
          1 /
          (1 - targetLtv)
        ).toFixed(2)}x. Skipping.`
      )
      continue
    }

    const loops =
      leverageTarget <= 1
        ? 1
        : Math.round(
            Math.log(1 - leverageTarget * (1 - targetLtv)) / Math.log(targetLtv)
          )

    // 6. Assemble Simulation Parameters
    const params: SimulationParams = {
      initialUsdc: CONFIG.initialUsdc,
      loops,
      lltv,
      buffer: CONFIG.buffer,
      ptApy,
      borrowApy,
      slippageBuy: CONFIG.slippageBuy,
      slippageSell: CONFIG.slippageSell,
      gasUnitsBuyPT: gasBuyPt,
      gasUnitsSellPT: gasSellPt,
      gasUnitsDeposit: gasDeposit,
      gasUnitsBorrow: gasBorrow,
      gasUnitsRepay: gasRepay,
      gasUnitsWithdraw: gasWithdraw,
      gasPriceGwei: Number(formatUnits(gasPriceGwei.maxFeePerGas, 9)),
      ethPriceUsd: ethPrice[0].price,
      horizonDays: daysToExpiry
    }

    // 7. Run Simulation
    console.log('\n--- Starting Simulation ---')
    const { rows, summary } = runPtLoopingSimulation(params)

    // 8. Display Results
    console.log('Simulation Results:')
    console.table(
      rows.map(r => ({
        Loop: r.loop,
        'Total USDC (USD)': r.usdc.toFixed(2),
        'Debt (USD)': r.debt.toFixed(2),
        LTV: (r.ltv * 100).toFixed(2) + '%',
        'Gas Cost (USD)': r.gasSpentUsd.toFixed(2),
        "Total PT (USD)": (r.ptValue).toFixed(2),
        "Total buy slippage (USD)": r.buySlippage.toFixed(2)
      }))
    )

    console.log('\n--- Simulation Summary ---')
    console.log(`Target Leverage: ${leverageTarget}x`)
    console.log(`Initial Investment: $${summary.initialUsdc.toFixed(2)}`)
    console.log(
      `Leverage Achieved: ${summary.leverage.toFixed(2)}x over ${summary.loops} loops`
    )
    console.log(
      `Target LTV: ${(summary.targetLtv * 100).toFixed(2)}% (LLTV: ${(
        lltv * 100
      ).toFixed(2)}%, Buffer: ${(CONFIG.buffer * 100).toFixed(2)}%)`
    )
    console.log(`---`)
    console.log(`Sell slippage (${params.slippageSell}): $${summary.sellSlippage.toFixed(2)}`)
    console.log(`Buy slippage (${params.slippageBuy}): $${summary.buySlippage.toFixed(2)}`)
    console.log(`---`)
    console.log(
      `Gross PnL (pre-gas): $${(
        summary.pnlUsd + summary.totalGasSpent
      ).toFixed(2)}`
    )
    console.log(`Total Gas Cost: $${summary.totalGasSpent.toFixed(2)}`)
    console.log(
      `  - Loop Gas Cost: $${summary.loopGasSpent.toFixed(2)} (${summary.loops} loops)`
    )
    console.log(`  - Unwind Gas Cost: $${summary.unwindGasSpent.toFixed(2)}`)
    console.log(`Net PnL (after gas): $${summary.pnlUsd.toFixed(2)}`)
    console.log(`---`)
    console.log(`Final Net APY: ${(summary.apr * 100).toFixed(2)}%`)
    console.log('--------------------------')
  }
}

main().catch(console.error)

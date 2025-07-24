export type SimulationParams = {
  initialUsdc: number
  loops: number
  lltv: number
  buffer: number
  ptApy: number
  borrowApy: number
  slippageBuy: number
  slippageSell: number
  gasUnitsPerLoop: number
  gasPriceGwei: number
  ethPriceUsd: number
  horizonDays: number
}

export type LoopRow = {
  loop: number
  collateralValue: number
  debt: number
  borrowedThisLoop: number
  ptValue: number
  gasSpentUsd: number
  ltv: number
}

export type SimulationSummary = {
  initialUsdc: number
  finalUsdcAfterCosts: number
  totalGasSpent: number
  pnlUsd: number
  apr: number
  loops: number
  targetLtv: number
  leverage: number
}

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

function gasCostUsd(units: number, gwei: number, ethPrice: number): number {
  return units * gwei * 1e-9 * ethPrice
}

export function runPtLoopingSimulation(p: SimulationParams): {
  rows: LoopRow[]
  summary: SimulationSummary
} {
  const targetLtv = p.lltv - p.buffer
  let usdc = p.initialUsdc
  let debt = 0
  let ptValue = 0
  const rows: LoopRow[] = []
  let totalGas = 0

  for (let i = 1; i <= p.loops; i++) {
    const ptBought = usdc * (1 - p.slippageBuy)
    ptValue += ptBought
    usdc = 0
    const loopGas = gasCostUsd(p.gasUnitsPerLoop, p.gasPriceGwei, p.ethPriceUsd)
    totalGas += loopGas

    if (i !== p.loops) {
      const collateralValue = ptValue
      const maxDebtAllowed = collateralValue * targetLtv
      const borrowAmt = Math.max(0, maxDebtAllowed - debt)

      debt += borrowAmt
      usdc += borrowAmt

      rows.push({
        loop: i,
        collateralValue,
        debt,
        borrowedThisLoop: borrowAmt,
        ptValue,
        gasSpentUsd: loopGas,
        ltv: collateralValue > 0 ? debt / collateralValue : 0
      })
    } else {
      rows.push({
        loop: i,
        collateralValue: 0,
        debt,
        borrowedThisLoop: 0,
        ptValue,
        gasSpentUsd: loopGas / 2,
        ltv: ptValue > 0 ? debt / ptValue : 0
      })
    }
  }

  const t = p.horizonDays / 365
  const ptGrowth = ptValue * p.ptApy * t
  const debtGrowth = debt * p.borrowApy * t

  const repayNeeded = debt + debtGrowth
  const ptRedeemValue = (ptValue + ptGrowth) * (1 - p.slippageSell)

  let usdcAfterUnwind = usdc + ptRedeemValue - repayNeeded

  const unwindGas = gasCostUsd(p.gasUnitsPerLoop, p.gasPriceGwei, p.ethPriceUsd)
  totalGas += unwindGas
  usdcAfterUnwind -= unwindGas // Subtract unwind gas from final amount, not totalGas.

  const pnl = usdcAfterUnwind - p.initialUsdc
  const apr = t > 0 ? pnl / p.initialUsdc / t : 0
  const leverage = ptValue / p.initialUsdc

  const summary: SimulationSummary = {
    initialUsdc: p.initialUsdc,
    finalUsdcAfterCosts: usdcAfterUnwind,
    totalGasSpent: totalGas,
    pnlUsd: pnl,
    apr,
    loops: p.loops,
    targetLtv,
    leverage
  }

  return { rows, summary }
}

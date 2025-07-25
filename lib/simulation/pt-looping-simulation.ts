export type SimulationParams = {
  initialUsdc: number
  loops: number
  lltv: number
  buffer: number
  ptApy: number
  borrowApy: number
  slippageBuy: number
  slippageSell: number
  gasUnitsBuyPT: number
  gasUnitsSellPT: number
  gasUnitsDeposit: number
  gasUnitsBorrow: number
  gasUnitsRepay: number
  gasUnitsWithdraw: number
  gasPriceGwei: number
  ethPriceUsd: number
  horizonDays: number
}

export type LoopRow = {
  loop: number
  usdc: number
  collateralValue: number
  debt: number
  borrowedThisLoop: number
  ptValue: number
  gasSpentUsd: number
  ltv: number
  buySlippage: number
}

export type SimulationSummary = {
  initialUsdc: number
  finalUsdcAfterCosts: number
  totalGasSpent: number
  loopGasSpent: number;
  unwindGasSpent: number;
  pnlUsd: number
  apr: number
  loops: number
  targetLtv: number
  leverage: number
  buySlippage: number
  sellSlippage: number
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
  let loopGasSpent = 0
  let unwindGasUnit = 0
  let totalBuySlippage = 0
  let totalUsdc = 0
  
  for (let i = 1; i <= p.loops; i++) {
    totalUsdc += usdc
    const ptBought = usdc * (1 - p.slippageBuy)
    const buySlippage = usdc * p.slippageBuy
    totalBuySlippage += buySlippage

    let loopGas = 0
    ptValue += ptBought
    usdc = 0
    loopGas += gasCostUsd(p.gasUnitsBuyPT, p.gasPriceGwei, p.ethPriceUsd)
    unwindGasUnit += p.gasUnitsSellPT

    if (i !== p.loops) {
      const collateralValue = ptValue
      const maxDebtAllowed = collateralValue * targetLtv
      const borrowAmt = Math.max(0, maxDebtAllowed - debt)
      loopGas += gasCostUsd(p.gasUnitsBorrow + p.gasUnitsDeposit, p.gasPriceGwei, p.ethPriceUsd)
      unwindGasUnit += p.gasUnitsRepay + p.gasUnitsWithdraw

      debt += borrowAmt
      usdc += borrowAmt

      rows.push({
        usdc: totalUsdc,
        loop: i,
        collateralValue,
        debt,
        borrowedThisLoop: borrowAmt,
        ptValue,
        gasSpentUsd: loopGas,
        ltv: collateralValue > 0 ? debt / collateralValue : 0,
        buySlippage: totalBuySlippage
      })
    } else {
      rows.push({
        usdc: totalUsdc,
        loop: i,
        collateralValue: 0,
        debt,
        borrowedThisLoop: 0,
        ptValue,
        gasSpentUsd: loopGas,
        ltv: ptValue > 0 ? debt / ptValue : 0,
        buySlippage: totalBuySlippage
      })
    }

    loopGasSpent += loopGas


  }

  const t = p.horizonDays / 365
  const ptGrowth = ptValue * p.ptApy * t
  const debtGrowth = debt * p.borrowApy * t

  const repayNeeded = debt + debtGrowth
  const ptRedeemValue = (ptValue + ptGrowth) * (1 - p.slippageSell)
  const sellSlippage = ptRedeemValue * p.slippageSell

  console.log("pt growth", ptGrowth)
  console.log("pt value", ptValue)
  console.log("pt growth with slippage", ptGrowth * (1 - p.slippageSell))
  console.log("debt", debt)
  console.log("debt growth", debt * p.borrowApy * t)
  console.log("borrow apy", p.borrowApy)
  console.log("Repay needed", repayNeeded)
  console.log("PT redeem value", ptRedeemValue)

//   let usdcAfterUnwind = p.initialUsdc + ptGrowth - debtGrowth
  let usdcAfterUnwind = ptRedeemValue - repayNeeded

  const unwindGasSpent = gasCostUsd(
    unwindGasUnit,
    p.gasPriceGwei,
    p.ethPriceUsd
  );

  const totalGasSpent = loopGasSpent + unwindGasSpent;
  usdcAfterUnwind -= totalGasSpent

  const pnl = usdcAfterUnwind - p.initialUsdc
  const apr = t > 0 ? pnl / p.initialUsdc / t : 0
  const leverage = ptValue / p.initialUsdc

  const summary: SimulationSummary = {
    buySlippage: totalBuySlippage,
    sellSlippage: sellSlippage,
    initialUsdc: p.initialUsdc,
    finalUsdcAfterCosts: usdcAfterUnwind,
    totalGasSpent,
    loopGasSpent,
    unwindGasSpent,
    pnlUsd: pnl,
    apr,
    loops: p.loops,
    targetLtv,
    leverage
  }

  return { rows, summary }
}

import { EngineAction } from '@inngest/workflow-kit'
import { MarketId } from '@morpho-org/blue-sdk'
import { SimulationState } from '@morpho-org/simulation-sdk'
import { ethers } from 'ethers'
import { parseUnits } from 'viem'
import { morphoAPI } from '../morpho/api'
import { supplyCollateralBorrow } from '../morpho/bundle'
import { buildSimulatedState } from '../morpho/get-simulation-state'
import { getPendleSwapTokensData } from '../pendle/swap'
import { erc20Approval, executeTransaction } from '../privy/utils'
import { getRedisClient } from '../redis/config'
import { actions } from './workflow-actions'

import { getDemoTokenData } from '../alchemy/utils'

// const PT_ADDRESS = '0xc347584b415715b1b66774b2899fef2fd3b56d6e'
// const MARKET_ADDRESS = '0xff43e751f2f07bbf84da1fc1fa12ce116bf447e5'
const PT_ADDRESS = '0x9f56094c450763769ba0ea9fe2876070c0fd5f77'
const MARKET_ADDRESS = '0xa36b60a14a1a5247912584768c6e53e1a269a9f7'
// const MARKET_ADDRESS = "0xda57abf95a7c21eb9df08fbaada182f749f6c62f"
// const PT_ADDRESS = "0xfc66d247f577bfc87df8a5267c43676c4a088b8b"

const PT_DECIMALS = 18
const MARKET_DECIMALS = 18
const USDC_DECIMALS = 6
const DAI_DECIMALS = 18
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'
const walletId = 'u6g0wul9ios8ga92x4qqojqg'

export const actionsWithHandlers: EngineAction[] = [
  {
    ...actions[0],
    handler: async ({ event, step, workflow, workflowAction, state }) => {
      const currState = workflowAction.id
      let amount
      let amountInWei: bigint
      let inputTokenAddress = USDC_ADDRESS

      if (currState === '1') {
        amount = event.data.amount
        amountInWei = parseUnits(String(amount), USDC_DECIMALS)
      } else {
        const prevState = String(Number(currState) - 1)
        const prevStateData = state.get(prevState)
        console.log(prevStateData)
        if (!prevStateData) {
          throw new Error(`No data from previous state ${prevState}`)
        }
        amount = prevStateData.amount
        amountInWei = BigInt(amount)
        const loanAsset = prevStateData.loanAsset
        if (loanAsset && loanAsset.address) {
          inputTokenAddress = loanAsset.address
        } else {
          throw new Error(
            `loanAsset not found in previous state for step ${currState}`
          )
        }
      }

      const amountOut: string = await step.run('buy-pt', async () => {
        const provider = new ethers.JsonRpcProvider('http://localhost:8545')
        const outTokenData = await getDemoTokenData(
          PT_ADDRESS,
          event.data.userWalletAddress,
          provider
        )
        const outTokenInitialAmount = parseUnits(
          outTokenData?.balance || '0',
          PT_DECIMALS
        )
        console.log('input amount: ', amount)
        const quote = await getPendleSwapTokensData(
          MARKET_ADDRESS,
          inputTokenAddress,
          PT_ADDRESS,
          amountInWei.toString(),
          0.3, // 10% slippage for demo mode
          true,
          1,
          event.data.userWalletAddress
        )
        console.log('got quote data')
        const tx = await erc20Approval(
          inputTokenAddress,
          quote.tx.to,
          amountInWei.toString(),
          event.data.userWalletAddress,
          1,
          true,
          60000,
          event.data.evmWalletId,
          event.data.userWalletAddress
        )
        console.log('Approve erc 20')
        const txData = {
          to: quote.tx.to,
          from: event.data.userWalletAddress,
          data: quote.tx.data,
          value: quote.tx.value || '0'
        }

        const txResponse = await executeTransaction(
          txData,
          1,
          {
            estimateGas: false,
            gasLimit: ethers.toQuantity(1000000) as `0x${string}`
          },
          true,
          60000,
          event.data.evmWalletId,
          event.data.userWalletAddress
        )
        console.log(`🔸 buy: buy ${quote.data.amountOut} PT`)
        const redis = await getRedisClient()
        await redis.hmset(`event:${event.data.id}`, {
          [`ptAmount-${currState}`]: String(quote.data.amountOut),
          [`txHash-${currState}`]: txResponse.hash
        })

        const finalOutTokenData = await getDemoTokenData(
          PT_ADDRESS,
          event.data.userWalletAddress,
          provider
        )
        const finalOutTokenAmount = parseUnits(
          finalOutTokenData?.balance || '0',
          PT_DECIMALS
        )
        console.log('finalOutTokenAmount', finalOutTokenAmount)
        console.log('outTokenInitialAmount', outTokenInitialAmount)
        const amountOut = finalOutTokenAmount - outTokenInitialAmount
        console.log("AmountOut buy-pt", amountOut)
        return amountOut.toString()
      })
      console.log("AmountOut buy-pt", amountOut)
      return { amount: amountOut }
    }
  },
  {
    ...actions[1],
    handler: async ({ event, step, workflow, workflowAction, state }) => {
      const currState = workflowAction.id
      const prevState = String(Number(currState) - 1)
      const depositAmount = state.get(prevState)?.amount
      console.log('depositAmount', depositAmount)
      const ptAmountInWei = parseUnits(String(depositAmount), PT_DECIMALS)

      const {
        provider,
        market,
        amountToBorrow,
        inTokenInitialData,
        outTokenInitialData,
        inTokenInitialAmount,
        outTokenInitialAmount
      } = await step.run('get-market-and-borrow-amount', async () => {
        const provider = new ethers.JsonRpcProvider('http://localhost:8545')
        const market = await morphoAPI.getMarketByKey(event.data.marketId, 1)
        if (!market) {
          throw new Error('Market not found')
        }
        const inTokenAddress = market.collateralAsset.address
        const outTokenAddress = market.loanAsset.address
        const inTokenInitialData = await getDemoTokenData(
          inTokenAddress,
          event.data.userWalletAddress,
          provider
        )
        const outTokenInitialData = await getDemoTokenData(
          outTokenAddress,
          event.data.userWalletAddress,
          provider
        )
        const inTokenInitialAmount = parseUnits(
          inTokenInitialData?.balance || '0',
          inTokenInitialData?.decimals || 18
        )
        const outTokenInitialAmount = parseUnits(
          outTokenInitialData?.balance || '0',
          outTokenInitialData?.decimals || 18
        )
        const lltv = parseFloat(market.lltv) / 1e18
        const amountToBorrow =
          Number(depositAmount) * lltv * (1 - 0.1) /* buffer */
        return {
          provider,
          market,
          amountToBorrow,
          inTokenInitialAmount,
          outTokenInitialAmount,
          inTokenInitialData,
          outTokenInitialData
        }
      })

      const outAmount = await step.run('deposit-pt-and-borrow', async () => {
        const simulationState = new SimulationState(
          await buildSimulatedState(
            event.data.marketId as MarketId,
            [event.data.userWalletAddress, "0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077"],
            1,
            'http://localhost:8545'
          )
        )

        const loanAssetDecimals = market.loanAsset.decimals

        await supplyCollateralBorrow(
          event.data.marketId as MarketId,
          event.data.userWalletAddress,
          event.data.evmWalletId,
          simulationState,
          ptAmountInWei,
          parseUnits(String(amountToBorrow), loanAssetDecimals)
        )

        const outTokenFinalData = await getDemoTokenData(
          market.loanAsset.address,
          event.data.userWalletAddress,
          provider as ethers.JsonRpcProvider
        )
        const outTokenFinalAmount = parseUnits(
          outTokenFinalData?.balance || '0',
          outTokenFinalData?.decimals || 18
        )

        const redis = await getRedisClient()
        await redis.hmset(`event:${event.data.id}`, {
          [`depositDone-${currState}`]: 'true'
        })
        const outAmount = outTokenFinalAmount - outTokenInitialAmount
        return outAmount.toString()
      })

      return {
        amount: outAmount,
        loanAsset: {
          address: market.loanAsset.address,
          decimals: market.loanAsset.decimals,
          symbol: market.loanAsset.symbol
        }
      }
    }
  },
  {
    ...actions[2],
    handler: async ({ event, step, workflow, workflowAction, state }) => {
      const currState = workflowAction.id
      const prevState = String(Number(currState) - 1)
      console.log(currState)
    }
  }
]

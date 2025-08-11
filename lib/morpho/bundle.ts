import {
  Address,
  addresses,
  ChainId,
  DEFAULT_SLIPPAGE_TOLERANCE,
  MarketId
} from '@morpho-org/blue-sdk'
import { SimulationState } from '@morpho-org/simulation-sdk'
import { setupBundle } from './bundler'
const { morpho } = addresses[ChainId.EthMainnet]

/**
 * Executes a series of Morpho operations: supply collateral, and borrow
 * @param marketId - The ID of the market to interact with
 * @param userAddress - The address of the user
 * @param simulationState - The current simulation state
 * @param amountSupplyCollateral - Amount to supply as collateral
 * @param amountBorrow - Amount to borrow
 * @returns Array of transaction responses
 */
export const supplyCollateralBorrow = async (
  marketId: MarketId,
  userAddress: Address,
  userWalletId: string,
  simulationState: SimulationState,
  amountSupplyCollateral: bigint,
  amountBorrow: bigint
) => {
  return setupBundle(userAddress, userWalletId, simulationState, [
    {
      type: 'Blue_SupplyCollateral',
      sender: userAddress,
      address: morpho,
      args: {
        id: marketId,
        assets: amountSupplyCollateral,
        onBehalf: userAddress
      }
    },
    {
      type: 'Blue_Borrow',
      sender: userAddress,
      address: morpho,
      args: {
        id: marketId,
        assets: amountBorrow,
        onBehalf: userAddress,
        receiver: userAddress,
        slippage: DEFAULT_SLIPPAGE_TOLERANCE
      }
    }
  ])
}

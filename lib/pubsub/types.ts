import { ChainType } from "../network/types"

export interface BalanceChangeEvent {
  affectedChains: ChainType[]
  isDemo: boolean
}
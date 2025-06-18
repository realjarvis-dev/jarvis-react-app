import { ChainType } from "../network/types"
import { bus } from "./simple-pubsub"
import { BalanceChangeEvent } from "./types"




export async function balanceChangePub(userId: string, affectedChains: ChainType[], isDemo: boolean) {
  affectedChains = [...new Set(affectedChains)]
  bus.emit('balance-change/' + userId, { affectedChains, isDemo } as BalanceChangeEvent)
  console.log('balance change event emitted', { affectedChains, isDemo })
  return 'balance change event emitted'
}
import { WalletWithMetadata } from '@privy-io/server-auth'
import { Message } from 'ai'
import { Model } from '../types/models'
import { NetworkContext } from '../types/context'

export interface BaseStreamConfig {
  messages: Message[]
  model: Model
  chatId: string
  searchMode: boolean,
  userId: string
  userEvmWallet: WalletWithMetadata | undefined
  userSolWallet: WalletWithMetadata | undefined
  allowWeb3Tools: string
  networkContext?: NetworkContext
}

import { WalletWithMetadata } from '@privy-io/server-auth'
import { Message } from 'ai'
import { NetworkContext } from '../types/context'
import { Model } from '../types/models'

export interface BaseStreamConfig {
  messages: Message[]
  model: Model
  chatId: string
  searchMode: boolean,
  deepResearchMode: boolean,
  userId: string
  userEvmWallet: WalletWithMetadata | undefined
  userSolWallet: WalletWithMetadata | undefined
  allowWeb3Tools: string
  networkContext?: NetworkContext
  isNewUser?: boolean
}

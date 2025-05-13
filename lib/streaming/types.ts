import { Message } from 'ai'
import { Model } from '../types/models'
import { WalletWithMetadata } from '@privy-io/server-auth'

export interface BaseStreamConfig {
  messages: Message[]
  model: Model
  chatId: string
  searchMode: boolean,
  userId: string
  userEvmWallet: WalletWithMetadata | undefined
  userSolWallet: WalletWithMetadata | undefined
}

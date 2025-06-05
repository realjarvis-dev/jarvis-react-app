import type { Network } from 'alchemy-sdk'
// We use 'import type' here for allNetworkConfigs because it's defined in config.ts,
// and config.ts might import types from this file, creating a potential cycle
// for values, but not for types.
import type { allNetworkConfigs } from './config'

/**
 * Represents the unique identifier for a chain.
 * This type is dynamically generated from the keys of `allNetworkConfigs` in `config.ts`.
 * e.g., 'ethereum' | 'berachain' | 'polygon' ...
 */
export type ChainType = keyof typeof allNetworkConfigs

/**
 * Defines the structure for a network's configuration.
 */
export interface NetworkConfig {
  /** The unique identifier for the chain, matching a key in `allNetworkConfigs`. */
  readonly id: ChainType
  /** The human-readable name for the network (e.g., "Ethereum", "Berachain Mainnet"). */
  readonly displayName: string
  /** The chain ID (e.g., 1 for Ethereum Mainnet). */
  readonly chainId: number
  /** The RPC URL for connecting to the network. */
  readonly rpcUrl: string
  /** The base URL for the network's block explorer (e.g., "etherscan.io"). Optional. */
  readonly scanLink?: string
  /** Flag indicating if this configuration represents a demo/test environment. */
  readonly isDemo: boolean
  /** Optional: The corresponding network enum from alchemy-sdk, if applicable. */
  readonly alchemyNetwork?: Network
  /** Optional: Icon for the chain */
  readonly icon?: string // Added as per chain-selector.tsx's ChainIcons
  readonly disabled?: boolean // Added optional disabled field
}

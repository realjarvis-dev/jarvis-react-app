import { Network } from "alchemy-sdk";

/**
 * Supported Alchemy networks (using SDK's Network enum)
 */
export type AlchemyNetwork = Network;

/**
 * SDK configuration
 */
export interface AlchemyTransfersConfig {
  network?: AlchemyNetwork;
}
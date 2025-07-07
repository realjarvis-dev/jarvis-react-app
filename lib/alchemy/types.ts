import { Network } from "alchemy-sdk";

export interface TokenData {
    address: string;
    name:    string;
    symbol:  string;
    balance: string;      // human-readable
    network: string;
    decimals: number;
  }

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
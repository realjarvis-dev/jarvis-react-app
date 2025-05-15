import { Network } from "alchemy-sdk";


export const nativeAssets: Record<Network|string, { name: string; symbol: string; decimals: number }> = {
  [Network.ETH_MAINNET]:    { name: "Ether",       symbol: "ETH", decimals: 18 },
  [Network.ETH_SEPOLIA]:    { name: "Sepolia Ether",       symbol: "ETH", decimals: 18},
  [Network.BERACHAIN_MAINNET]:    { name: "BERA Token",       symbol: "BERA", decimals: 18},
  [Network.BERACHAIN_BEPOLIA]:    { name: "Testnet BERA Token", symbol: "BERA", decimals: 18},

};  
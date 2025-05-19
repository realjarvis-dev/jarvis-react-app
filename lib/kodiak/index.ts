// Export API methods
export {
    fetchKodiakIslands, getKodiakIslandByAddress, getKodiakOpportunities
} from './api';

// Export utility functions
export { formatAPR, formatPriceRange, formatTVL, tickToPrice } from './utils';

// Export investment management functions
export {
    calculateMinimumWithSlippage, calculateSwapAmount, generateDepositTx, generateSingleSidedDepositTx, generateSingleSidedWithdrawTx, generateWithdrawTx
} from './island-manager';

// Export interfaces
export type {
    DepositParams,
    SingleSidedDepositParams, SingleSidedWithdrawParams, WithdrawParams
} from './island-manager';

// Export contract addresses and configurations
export const KODIAK_CONTRACTS = {
  // Bepolia testnet
  bepolia: {
    factory: '0x85F42bf3aDC6F9ED718a26e3CC64af73B756812e',
    router: '0x558dA0ff61Bca43453d8bD1e0b6c89cCeA8a597d'
  },
  // Berachain mainnet
  mainnet: {
    factory: '0x5261c5A5f08818c08Ed0Eb036d9575bA1E02c1d6', 
    router: '0x679a7C63FC83b6A4D9C1F931891d705483d4791F'
  }
}; 
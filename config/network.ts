/**
 * Network configurations for different blockchains
 */

/**
 * Berachain Testnet (Bepolia) configuration
 */
export const BepoliaConfig = {
  chainId: 80085,
  name: 'Bepolia',
  rpcUrl: 'https://rpc-testnet.berachain.com',
  blockExplorerUrl: 'https://bepolia.beratrail.io',
  nativeCurrency: {
    name: 'Bera',
    symbol: 'BERA',
    decimals: 18
  }
};

/**
 * Berachain Mainnet configuration
 */
export const BerachainMainnetConfig = {
  chainId: 80085,
  name: 'Berachain',
  rpcUrl: 'https://rpc.berachain.com',
  blockExplorerUrl: 'https://beratrail.io',
  nativeCurrency: {
    name: 'Bera',
    symbol: 'BERA',
    decimals: 18
  }
}; 
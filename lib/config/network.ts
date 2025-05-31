import { Network } from "alchemy-sdk";

type NetworkConfigType = {
    name: Network,
    chainId: number,
    scanLink: string,
    rpcUrl: string
}

export const MainnetConfig = {
    name: Network.ETH_MAINNET,
    chainId: 1,
    scanLink: 'etherscan.io',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}

export const TenderlyDemoConfig = {
    name: Network.ETH_MAINNET, // Using ETH_MAINNET as base for demo mode
    chainId: 92736,
    scanLink: 'dashboard.tenderly.co/explorer/vnet/fcb5c956-9f40-4ccb-8ea3-249ea2de031d', // Updated to use Tenderly vnet explorer
    rpcUrl: 'https://virtual.mainnet.rpc.tenderly.co/fcb5c956-9f40-4ccb-8ea3-249ea2de031d'
}

console.log('process.env.NEXT_PUBLIC_TEST_NET_ENV', process.env.NEXT_PUBLIC_TEST_NET_ENV)
export const NetworkConfig = MainnetConfig;

export const BerachainMainnetConfig = {
    name: Network.BERACHAIN_MAINNET,
    chainId: 80094,
    scanLink: 'berascan.com',
    rpcUrl: 'https://berachain-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}

export const chainIdToNetworkConfig: Record<number, NetworkConfigType> = {
    [BerachainMainnetConfig.chainId]: BerachainMainnetConfig,
    [MainnetConfig.chainId]: MainnetConfig,
    [TenderlyDemoConfig.chainId]: TenderlyDemoConfig
}

export const getConfigByChainId = (chainId: number) => {
    if (chainId in chainIdToNetworkConfig) {
        return chainIdToNetworkConfig[chainId];
    }
    throw new Error(`No config found for chainId: ${chainId}`);
}
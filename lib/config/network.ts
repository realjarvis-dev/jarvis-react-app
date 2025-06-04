import { Network } from "alchemy-sdk";

type NetworkConfigType = {
    name: Network,
    chainId: number,
    scanLink: string,
    rpcUrl: string,
    displayName: string
}

export const MainnetConfig = {
    name: Network.ETH_MAINNET,
    displayName: 'Ethereum',
    chainId: 1,
    scanLink: 'etherscan.io',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
    // rpcUrl: 'https://virtual.mainnet.rpc.tenderly.co/ee6b4080-0224-4394-9498-4510c16df471'
}
export const BaseMainnetConfig = {
    name: Network.BASE_MAINNET,
    displayName: 'Base',
    chainId: 8453,
    scanLink: 'basescan.org',
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
    // rpcUrl: 'https://virtual.base.rpc.tenderly.co/3233a1c6-a61f-4411-8c4b-04d4bc434fc2'
}
export const ArbitrumConfig = {
    name: Network.ARB_MAINNET,
    displayName: 'Arbitrum',
    chainId: 42161,
    scanLink: 'arbiscan.io',
    rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}
export const PolygonConfig = {
    name: Network.MATIC_MAINNET,
    displayName: 'Polygon',
    chainId: 137,
    scanLink: 'polygonscan.com',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
    // rpcUrl: 'https://virtual.polygon.rpc.tenderly.co/fa7f4f0a-086a-4f67-8e97-f3898af82f53'
}

// export const TenderlyDemoConfig = {
//     name: Network.ETH_MAINNET, // Using ETH_MAINNET as base for demo mode
//     displayName: 'Demo',
//     chainId: 92736,
//     scanLink: 'dashboard.tenderly.co/explorer/vnet/fcb5c956-9f40-4ccb-8ea3-249ea2de031d', // Updated to use Tenderly vnet explorer
//     rpcUrl: 'https://virtual.mainnet.rpc.tenderly.co/fcb5c956-9f40-4ccb-8ea3-249ea2de031d'
// }
export const TenderlyDemoConfig = {
        name: Network.ETH_MAINNET, // Using ETH_MAINNET as base for demo mode
        displayName: 'Demo',
        chainId: 1,
        scanLink: 'dashboard.tenderly.co/explorer/vnet/ce583582-c194-4405-bfc5-6ee33e99fa8b', // Updated to use Tenderly vnet explorer
        rpcUrl: 'https://virtual.mainnet.rpc.tenderly.co/ce583582-c194-4405-bfc5-6ee33e99fa8b'
    }
export const BerachainMainnetConfig = {
    name: Network.BERACHAIN_MAINNET,
    displayName: "Berachain",
    chainId: 80094,
    scanLink: 'berascan.com',
    rpcUrl: 'https://berachain-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}

export const OptimismConfig = {
    name: Network.OPT_MAINNET,
    displayName: "Optimism",
    chainId: 10,
    scanLink: 'optimistic.etherscan.io',
    rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}

export const chainIdToNetworkConfig: Record<number, NetworkConfigType> = {
    [BerachainMainnetConfig.chainId]: BerachainMainnetConfig,
    [MainnetConfig.chainId]: MainnetConfig,
    // [TenderlyDemoConfig.chainId]: TenderlyDemoConfig,
    [PolygonConfig.chainId]: PolygonConfig,
    [BaseMainnetConfig.chainId]: BaseMainnetConfig,
    [ArbitrumConfig.chainId]: ArbitrumConfig,
    [OptimismConfig.chainId]: OptimismConfig
}

export const getConfigByChainId = (chainId: number, isDemo=false) => {
    if (isDemo || chainId === 92736) {
        return TenderlyDemoConfig
    }
    if (chainId in chainIdToNetworkConfig) {
        return chainIdToNetworkConfig[chainId];
    }
    throw new Error(`No config found for chainId: ${chainId}`);
}

// console.log(getConfigByChainId(42161))
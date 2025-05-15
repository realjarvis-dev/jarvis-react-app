import { Network } from "alchemy-sdk";
export const SepoliaConfig = {
    name: Network.ETH_SEPOLIA,
    chainId: 11155111,
    scanLink: 'sepolia.etherscan.io',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}

export const MainnetConfig = {
    name: Network.ETH_MAINNET,
    chainId: 1,
    scanLink: 'etherscan.io',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}
console.log('process.env.NEXT_PUBLIC_TEST_NET_ENV', process.env.NEXT_PUBLIC_TEST_NET_ENV)
export const NetworkConfig = process.env.NEXT_PUBLIC_TEST_NET_ENV === 'production' ? MainnetConfig : SepoliaConfig;

export const BerachainMainnetConfig = {
    name: Network.BERACHAIN_MAINNET,
    chainId: 80094,
    scanLink: 'berascan.com',
    rpcUrl: 'https://berachain-mainnet.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}

export const BepoliaConfig = {
    name: Network.BERACHAIN_BEPOLIA,
    chainId: 80069,
    scanLink: 'https://testnet.berascan.com/',
    rpcUrl: 'https://berachain-bepolia.g.alchemy.com/v2/yIRJoLX9TId7oSWYdnflKgthIy59m-vr'
}

export const SepoliaConfig = {
    name: 'Sepolia',
    chainId: 11155111,
    scanLink: 'sepolia.etherscan.io'
}

export const MainnetConfig = {
    name: 'Mainnet',
    chainId: 1,
    scanLink: 'etherscan.io'
}
console.log('process.env.TEST_NET_ENV', process.env.TEST_NET_ENV)
export const NetworkConfig = process.env.TEST_NET_ENV === 'production' ? MainnetConfig : SepoliaConfig;

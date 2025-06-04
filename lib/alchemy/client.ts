import { Alchemy, AlchemySettings, Network } from 'alchemy-sdk'
import { TenderlyDemoConfig } from '../config/network'
// 1. Define your shared defaults
const API_KEY = process.env.ALCHEMY_API_KEY!
const DEFAULT_OVERRIDES: Partial<AlchemySettings> = {
  connectionInfoOverrides: { skipFetchSetup: true }
}

// 2. Helper to create a configured Alchemy client
function makeAlchemyClient(
  network: Network,
  opts: Partial<AlchemySettings> = {}
) {
  return new Alchemy({
    apiKey: API_KEY,
    network,
    // merge in any overrides (e.g. skipFetchSetup) with defaults
    ...DEFAULT_OVERRIDES,
    ...opts
  })
}

export const demoAlchemy = makeAlchemyClient(Network.ETH_MAINNET, {
  connectionInfoOverrides: {
    skipFetchSetup: true,
    url: TenderlyDemoConfig.rpcUrl
  }
})

// 3. Instantiate all your clients in one place
export const mainnetAlchemy = makeAlchemyClient(Network.ETH_MAINNET)
export const sepoliaAlchemy = makeAlchemyClient(Network.ETH_SEPOLIA)
export const polygonAlchemy = makeAlchemyClient(Network.MATIC_MAINNET)
export const baseAlchemy = makeAlchemyClient(Network.BASE_MAINNET)
export const arbitrumAlchemy = makeAlchemyClient(Network.ARB_MAINNET)
export const berachainMainnetAlchemy = makeAlchemyClient(
  Network.BERACHAIN_MAINNET
)
export const berachainBepoliaAlchemy = makeAlchemyClient(
  Network.BERACHAIN_BEPOLIA
)
export const optimismAlchemy = makeAlchemyClient(Network.OPT_MAINNET)

export const chainIdToAlchemyClient: Record<number, Alchemy> = {
  1: mainnetAlchemy,
  11155111: sepoliaAlchemy,
  80094: berachainMainnetAlchemy,
  80069: berachainBepoliaAlchemy,
  137: polygonAlchemy,
  8453: baseAlchemy,
  42161: arbitrumAlchemy,
  10: optimismAlchemy
}

export const getAlchemyClient = (chainId: number, isDemo=false) => {
  if (isDemo) {
    return demoAlchemy
  }
  return chainIdToAlchemyClient[chainId]
}

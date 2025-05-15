import { Alchemy, AlchemySettings, Network } from 'alchemy-sdk'

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

// 3. Instantiate all your clients in one place
export const mainnetAlchemy = makeAlchemyClient(Network.ETH_MAINNET)
export const sepoliaAlchemy = makeAlchemyClient(Network.ETH_SEPOLIA)
export const berachainMainnetAlchemy = makeAlchemyClient(
  Network.BERACHAIN_MAINNET
)
export const berachainBepoliaAlchemy = makeAlchemyClient(
  Network.BERACHAIN_BEPOLIA
)

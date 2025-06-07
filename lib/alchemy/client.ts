import { TENDERLY_DEMO_CONFIG, allNetworkConfigs } from '@/lib/network/config'
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

// Demo client configured for Tenderly
export const demoAlchemy = makeAlchemyClient(
  TENDERLY_DEMO_CONFIG.alchemyNetwork || Network.ETH_MAINNET,
  {
    connectionInfoOverrides: {
      skipFetchSetup: true,
      url: TENDERLY_DEMO_CONFIG.rpcUrl
    }
  }
)

// 3. Instantiate clients dynamically from allNetworkConfigs
export const chainIdToAlchemyClient: Record<number, Alchemy> = {}

Object.values(allNetworkConfigs).forEach(config => {
  if (config.alchemyNetwork) {
    chainIdToAlchemyClient[config.chainId] = makeAlchemyClient(
      config.alchemyNetwork
    )
  }
})

export const getAlchemyClient = (
  chainId: number,
  isDemo = false
): Alchemy | undefined => {
  if (isDemo) {
    if (chainId === TENDERLY_DEMO_CONFIG.chainId) {
      return demoAlchemy
    }
    throw new Error(
      `Demo mode requested for chainId ${chainId}, but demo is configured for ${TENDERLY_DEMO_CONFIG.chainId}.`
    )
  }
  const client = chainIdToAlchemyClient[chainId]
  if (!client) {
    throw new Error(`No Alchemy client found for chainId ${chainId}`)
  }
  return client
}

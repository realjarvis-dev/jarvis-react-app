import Fuse from 'fuse.js'
import { chains } from './config/lifi/chains'


export type Chain = {
  id: number
  name: string
  coin: string
}


export class ChainMatcher {
  private fuse: Fuse<Chain>
  constructor(chainList = chains, threshold = 0.3) {
    this.fuse = new Fuse(chainList, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'coin', weight: 0.2 },
        { name: 'id', weight: 0.3 }
      ],
      threshold,
      ignoreLocation: true,
      minMatchCharLength: 2
    })
  }

  /**
   * @param {string} query — chain name, key, or symbol
   * @param {number} [limit=3] — max results
   * @returns {Chain[]}
   */
  match(query: string, limit = 3): Chain[] {
    const results = this.fuse.search(query, { limit })
    return results.map(({ item }) => item)
  }
}

export const chainsById: Record<number, Chain> = {
  1: {
    name: 'Ethereum',
    coin: 'ETH',
    id: 1,
  },
  56: {

    name: 'BSC',
    coin: 'BNB',
    id: 56,

  },
  42161: {

    name: 'Arbitrum',
    coin: 'ETH',
    id: 42161,

  },
  8453: {

    name: 'Base',
    coin: 'ETH',
    id: 8453,

  },
  81457: {
    name: 'Blast',
    coin: 'ETH',
    id: 81457,
  },
  43114: {
    name: 'Avalanche',
    coin: 'AVAX',
    id: 43114,
  },
  137: {
    name: 'Polygon',
    coin: 'POL',
    id: 137,
  },
  534352: {
    name: 'Scroll',
    coin: 'ETH',
    id: 534352,
  },
  10: {
    
    name: 'Optimism',
    coin: 'ETH',
    id: 10,
    
  },
  59144: {
    
    name: 'Linea',
    coin: 'ETH',
    id: 59144,
    
  },
  324: {
    
    name: 'zkSync',
    coin: 'ETH',
    id: 324,
    
  },
  1101: {
    
    name: 'Polygon zkEVM',
    coin: 'ETH',
    id: 1101,
    
  },
  100: {
    
    name: 'Gnosis',
    coin: 'DAI',
    id: 100,
    
  },
  250: {
    
    name: 'Fantom',
    coin: 'FTM',
    id: 250,
    
  },
  1285: {
    
    name: 'Moonriver',
    coin: 'MOVR',
    id: 1285,
    
  },
  1284: {
    
    name: 'Moonbeam',
    coin: 'GLMR',
    id: 1284,
    
  },
  122: {
    
    name: 'FUSE',
    coin: 'FUSE',
    id: 122,
    
  },
  288: {
    
    name: 'Boba',
    coin: 'ETH',
    id: 288,
    
  },
  34443: {
    
    name: 'Mode',
    coin: 'ETH',
    id: 34443,
    
  },
  1088: {
    
    name: 'Metis',
    coin: 'METIS',
    id: 1088,
    
  },
  1135: {
    
    name: 'Lisk',
    coin: 'ETH',
    id: 1135,
    
  },
  130: {
    
    name: 'Unichain',
    coin: 'ETH',
    id: 130,
    
  },
  1313161554: {
    
    name: 'Aurora',
    coin: 'ETH',
    id: 1313161554,
    
  },
  1329: {
    
    name: 'Sei',
    coin: 'SEI',
    id: 1329,
    
  },
  13371: {
    
    name: 'Immutable zkEVM',
    coin: 'IMX',
    id: 13371,
    
  },
  146: {
    
    name: 'Sonic',
    coin: 'S',
    id: 146,
    
  },
  1625: {
    
    name: 'Gravity',
    coin: 'G',
    id: 1625,
    
  },
  167000: {
    
    name: 'Taiko',
    coin: 'ETH',
    id: 167000,
    
  },
  1868: {
    
    name: 'Soneium',
    coin: 'ETH',
    id: 1868,
    
  },
  1923: {
    
    name: 'Swellchain',
    coin: 'ETH',
    id: 1923,
    
  },
  21000000: {
    
    name: 'Corn',
    coin: 'BTCN',
    id: 21000000,
    
  },
  232: {
    
    name: 'Lens',
    coin: 'GHO',
    id: 232,
    
  },
  25: {
    
    name: 'Cronos',
    coin: 'CRO',
    id: 25,
    
  },
  252: {
    
    name: 'Fraxtal',
    coin: 'frxETH',
    id: 252,
    
  },
  2741: {
    
    name: 'Abstract',
    coin: 'ETH',
    id: 2741,
    
  },
  30: {
    
    name: 'Rootstock',
    coin: 'RBTC',
    id: 30,
    
  },
  33139: {
    
    name: 'Apechain',
    coin: 'APE',
    id: 33139,
    
  },
  42220: {
    
    name: 'Celo',
    coin: 'CELO',
    id: 42220,
    
  },
  480: {
    
    name: 'World Chain',
    coin: 'ETH',
    id: 480,
    
  },
  5000: {
    
    name: 'Mantle',
    coin: 'MNT',
    id: 5000,
    
  },
  55244: {
    
    name: 'Superposition',
    coin: 'ETH',
    id: 55244,
    
  },
  57073: {
    
    name: 'Ink',
    coin: 'ETH',
    id: 57073,
    
  },
  60808: {
    
    name: 'BOB',
    coin: 'ETH',
    id: 60808,
    
  },
  80094: {
    
    name: 'Berachain',
    coin: 'BERA',
    id: 80094,
    
  },
  8217: {
    
    name: 'Kaia',
    coin: 'KLAY',
    id: 8217,
    
  }
}

import Fuse from 'fuse.js';
import { chains } from './config/chains';

type Chain = (typeof chains)[number];
export type ChainWithScore = Chain & { score: number };

export class ChainMatcher {
  private fuse: Fuse<Chain>;
  constructor(chainList = chains, threshold = 0.3) {
    this.fuse = new Fuse(chainList, {
      keys: [
        { name: 'key', weight: 0.3 },
        { name: 'name', weight: 0.5 },
        { name: 'coin', weight: 0.2 },
      ],
      threshold,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }

  /**
   * @param {string} query — chain name, key, or symbol
   * @param {number} [limit=3] — max results
   * @returns {ChainWithScore[]}
   */
  match(query: string, limit = 3): ChainWithScore[] {

    const results = this.fuse.search(query, { limit });
    return results.map(({ item, score }) => ({
      key: item.key,
      chainType: item.chainType,
      id: item.id,
      name: item.name,
      coin: item.coin,
      score: score ?? 0,
      mainnet: item.mainnet,
    }));
  }
}

export const chainsById: Record<number, Chain> = {
  1: {
    key: "eth",
    chainType: "EVM",
    name: "Ethereum",
    coin: "ETH",
    id: 1,
    mainnet: true
  },
  56: {
    key: "bsc",
    chainType: "EVM",
    name: "BSC",
    coin: "BNB",
    id: 56,
    mainnet: true
  },
  42161: {
    key: "arb",
    chainType: "EVM",
    name: "Arbitrum",
    coin: "ETH",
    id: 42161,
    mainnet: true
  },
  8453: {
    key: "bas",
    chainType: "EVM",
    name: "Base",
    coin: "ETH",
    id: 8453,
    mainnet: true
  },
  81457: {
    key: "bls",
    chainType: "EVM",
    name: "Blast",
    coin: "ETH",
    id: 81457,
    mainnet: true
  },
  43114: {
    key: "ava",
    chainType: "EVM",
    name: "Avalanche",
    coin: "AVAX",
    id: 43114,
    mainnet: true
  },
  137: {
    key: "pol",
    chainType: "EVM",
    name: "Polygon",
    coin: "POL",
    id: 137,
    mainnet: true
  },
  534352: {
    key: "scl",
    chainType: "EVM",
    name: "Scroll",
    coin: "ETH",
    id: 534352,
    mainnet: true
  },
  10: {
    key: "opt",
    chainType: "EVM",
    name: "Optimism",
    coin: "ETH",
    id: 10,
    mainnet: true
  },
  59144: {
    key: "lna",
    chainType: "EVM",
    name: "Linea",
    coin: "ETH",
    id: 59144,
    mainnet: true
  },
  324: {
    key: "era",
    chainType: "EVM",
    name: "zkSync",
    coin: "ETH",
    id: 324,
    mainnet: true
  },
  1101: {
    key: "pze",
    chainType: "EVM",
    name: "Polygon zkEVM",
    coin: "ETH",
    id: 1101,
    mainnet: true
  },
  100: {
    key: "dai",
    chainType: "EVM",
    name: "Gnosis",
    coin: "DAI",
    id: 100,
    mainnet: true
  },
  250: {
    key: "ftm",
    chainType: "EVM",
    name: "Fantom",
    coin: "FTM",
    id: 250,
    mainnet: true
  },
  1285: {
    key: "mor",
    chainType: "EVM",
    name: "Moonriver",
    coin: "MOVR",
    id: 1285,
    mainnet: true
  },
  1284: {
    key: "moo",
    chainType: "EVM",
    name: "Moonbeam",
    coin: "GLMR",
    id: 1284,
    mainnet: true
  },
  122: {
    key: "fus",
    chainType: "EVM",
    name: "FUSE",
    coin: "FUSE",
    id: 122,
    mainnet: true
  },
  288: {
    key: "bob",
    chainType: "EVM",
    name: "Boba",
    coin: "ETH",
    id: 288,
    mainnet: true
  },
  34443: {
    key: "mod",
    chainType: "EVM",
    name: "Mode",
    coin: "ETH",
    id: 34443,
    mainnet: true
  },
  1088: {
    key: "mam",
    chainType: "EVM",
    name: "Metis",
    coin: "METIS",
    id: 1088,
    mainnet: true
  },
  1135: {
    key: "lsk",
    chainType: "EVM",
    name: "Lisk",
    coin: "ETH",
    id: 1135,
    mainnet: true
  },
  130: {
    key: "uni",
    chainType: "EVM",
    name: "Unichain",
    coin: "ETH",
    id: 130,
    mainnet: true
  },
  1313161554: {
    key: "aur",
    chainType: "EVM",
    name: "Aurora",
    coin: "ETH",
    id: 1313161554,
    mainnet: true
  },
  1329: {
    key: "sei",
    chainType: "EVM",
    name: "Sei",
    coin: "SEI",
    id: 1329,
    mainnet: true
  },
  13371: {
    key: "imx",
    chainType: "EVM",
    name: "Immutable zkEVM",
    coin: "IMX",
    id: 13371,
    mainnet: true
  },
  146: {
    key: "son",
    chainType: "EVM",
    name: "Sonic",
    coin: "S",
    id: 146,
    mainnet: true
  },
  1625: {
    key: "gra",
    chainType: "EVM",
    name: "Gravity",
    coin: "G",
    id: 1625,
    mainnet: true
  },
  167000: {
    key: "tai",
    chainType: "EVM",
    name: "Taiko",
    coin: "ETH",
    id: 167000,
    mainnet: true
  },
  1868: {
    key: "soe",
    chainType: "EVM",
    name: "Soneium",
    coin: "ETH",
    id: 1868,
    mainnet: true
  },
  1923: {
    key: "swl",
    chainType: "EVM",
    name: "Swellchain",
    coin: "ETH",
    id: 1923,
    mainnet: true
  },
  21000000: {
    key: "crn",
    chainType: "EVM",
    name: "Corn",
    coin: "BTCN",
    id: 21000000,
    mainnet: true
  },
  232: {
    key: "lns",
    chainType: "EVM",
    name: "Lens",
    coin: "GHO",
    id: 232,
    mainnet: true
  },
  25: {
    key: "cro",
    chainType: "EVM",
    name: "Cronos",
    coin: "CRO",
    id: 25,
    mainnet: true
  },
  252: {
    key: "fra",
    chainType: "EVM",
    name: "Fraxtal",
    coin: "frxETH",
    id: 252,
    mainnet: true
  },
  2741: {
    key: "abs",
    chainType: "EVM",
    name: "Abstract",
    coin: "ETH",
    id: 2741,
    mainnet: true
  },
  30: {
    key: "rsk",
    chainType: "EVM",
    name: "Rootstock",
    coin: "RBTC",
    id: 30,
    mainnet: true
  },
  33139: {
    key: "ape",
    chainType: "EVM",
    name: "Apechain",
    coin: "APE",
    id: 33139,
    mainnet: true
  },
  42220: {
    key: "cel",
    chainType: "EVM",
    name: "Celo",
    coin: "CELO",
    id: 42220,
    mainnet: true
  },
  480: {
    key: "wcc",
    chainType: "EVM",
    name: "World Chain",
    coin: "ETH",
    id: 480,
    mainnet: true
  },
  5000: {
    key: "mnt",
    chainType: "EVM",
    name: "Mantle",
    coin: "MNT",
    id: 5000,
    mainnet: true
  },
  55244: {
    key: "sup",
    chainType: "EVM",
    name: "Superposition",
    coin: "ETH",
    id: 55244,
    mainnet: true
  },
  57073: {
    key: "ink",
    chainType: "EVM",
    name: "Ink",
    coin: "ETH",
    id: 57073,
    mainnet: true
  },
  60808: {
    key: "boc",
    chainType: "EVM",
    name: "BOB",
    coin: "ETH",
    id: 60808,
    mainnet: true
  },
  80094: {
    key: "ber",
    chainType: "EVM",
    name: "Berachain",
    coin: "BERA",
    id: 80094,
    mainnet: true
  },
  8217: {
    key: "kai",
    chainType: "EVM",
    name: "Kaia",
    coin: "KLAY",
    id: 8217,
    mainnet: true
  },
}
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

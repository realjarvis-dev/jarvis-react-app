/**
 * CoinGecko Market Chart API functions
 * Provides historical market data for cryptocurrencies
 */

export interface MarketChartDataPoint {
  timestamp: number // Unix timestamp in milliseconds
  price: number
  marketCap: number
  volume: number
}

export interface MarketChartResponse {
  prices: [number, number][] // [timestamp, price]
  market_caps: [number, number][] // [timestamp, market_cap]
  total_volumes: [number, number][] // [timestamp, volume]
}

export interface ProcessedMarketData {
  data: MarketChartDataPoint[]
  coinId: string
  currency: string
  days: number
  currentPrice: number
}

/**
 * Retry configuration for API calls
 */
interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt)
  return Math.min(delay, config.maxDelay)
}

/**
 * Sanitize and validate coin ID
 */
function sanitizeCoinId(coinId: string): string {
  // Remove any potentially dangerous characters and normalize
  return coinId.toLowerCase().replace(/[^a-z0-9-]/g, '').trim()
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors, timeouts, and 5xx errors are retryable
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true
  if (error.message?.includes('network') || error.message?.includes('timeout')) return true
  if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) return true
  return false
}

/**
 * Fetches historical market chart data from CoinGecko API with retry logic
 * @param coinId - The CoinGecko coin ID (e.g., 'bitcoin', 'ethereum')
 * @param days - Number of days of historical data (default: 7)
 * @param currency - Target currency (default: 'usd')
 * @param retryConfig - Retry configuration (optional)
 * @returns Promise<MarketChartResponse>
 */
export async function fetchMarketChart(
  coinId: string,
  days: number = 7,
  currency: string = 'usd',
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<MarketChartResponse> {
  // Sanitize inputs
  const sanitizedCoinId = sanitizeCoinId(coinId)
  const sanitizedCurrency = currency.toLowerCase().replace(/[^a-z]/g, '')
  const sanitizedDays = Math.max(1, Math.min(365, Math.floor(days)))

  if (!sanitizedCoinId) {
    throw new Error('Invalid coin ID provided')
  }

  const apiKey = process.env.COINGECKO_API_KEY
  const baseUrl = 'https://api.coingecko.com/api/v3'

  const url = `${baseUrl}/coins/${sanitizedCoinId}/market_chart`
  const params = new URLSearchParams({
    vs_currency: sanitizedCurrency,
    days: sanitizedDays.toString(),
    ...(apiKey && { 'x-cg-demo-api-key': apiKey })
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 seconds timeout

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Jarvis-Investment-Agent/1.0',
          ...(apiKey && { 'x-cg-demo-api-key': apiKey })
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        const error = new Error(
          `CoinGecko API error: ${response.status} ${response.statusText} - ${errorText}`
        )
        
        // Don't retry 4xx errors except for 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw error
        }
        
        throw error
      }

      const data = await response.json()

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from CoinGecko API: not an object')
      }

      if (!data.prices || !Array.isArray(data.prices)) {
        throw new Error('Invalid response format from CoinGecko API: missing or invalid prices array')
      }

      if (!data.market_caps || !Array.isArray(data.market_caps)) {
        throw new Error('Invalid response format from CoinGecko API: missing or invalid market_caps array')
      }

      if (!data.total_volumes || !Array.isArray(data.total_volumes)) {
        throw new Error('Invalid response format from CoinGecko API: missing or invalid total_volumes array')
      }

      // Check if arrays have data
      if (data.prices.length === 0) {
        throw new Error(`No market data available for ${sanitizedCoinId}`)
      }

      return data as MarketChartResponse
    } catch (error: any) {
      lastError = error
      console.error(`Attempt ${attempt + 1} failed for ${sanitizedCoinId}:`, error.message)

      // Don't retry on the last attempt
      if (attempt === retryConfig.maxRetries) {
        break
      }

      // Only retry if it's a retryable error
      if (!isRetryableError(error)) {
        break
      }

      // Calculate delay for exponential backoff
      const delay = calculateBackoffDelay(attempt, retryConfig)
      console.log(`Retrying in ${delay}ms...`)
      await sleep(delay)
    }
  }

  // If we get here, all retries failed
  throw new Error(`Failed to fetch market chart data for ${sanitizedCoinId} after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Processes raw market chart data into a more usable format
 * @param rawData - Raw response from CoinGecko API
 * @param coinId - The coin ID for reference
 * @param currency - The currency used
 * @param days - Number of days requested
 * @returns ProcessedMarketData
 */
export function processMarketChartData(
  rawData: MarketChartResponse,
  coinId: string,
  currency: string,
  days: number
): ProcessedMarketData {
  const data: MarketChartDataPoint[] = []

  // Ensure all arrays have the same length
  const minLength = Math.min(
    rawData.prices.length,
    rawData.market_caps.length,
    rawData.total_volumes.length
  )

  for (let i = 0; i < minLength; i++) {
    data.push({
      timestamp: rawData.prices[i][0],
      price: rawData.prices[i][1],
      marketCap: rawData.market_caps[i][1],
      volume: rawData.total_volumes[i][1]
    })
  }

  // Extract current price from the most recent data point
  const currentPrice = data.length > 0 ? data[data.length - 1].price : 0

  return {
    data,
    coinId,
    currency,
    days,
    currentPrice
  }
}

/**
 * Common coin ID mappings for user-friendly names
 */
const COIN_ID_MAPPINGS: Record<string, string> = {
  'btc': 'bitcoin',
  'eth': 'ethereum',
  'sol': 'solana',
  'ada': 'cardano',
  'dot': 'polkadot',
  'avax': 'avalanche-2',
  'matic': 'matic-network',
  'atom': 'cosmos',
  'link': 'chainlink',
  'uni': 'uniswap',
  'doge': 'dogecoin',
  'shib': 'shiba-inu',
  'ltc': 'litecoin',
  'bch': 'bitcoin-cash',
  'xlm': 'stellar',
  'vet': 'vechain',
  'icp': 'internet-computer',
  'fil': 'filecoin',
  'trx': 'tron',
  'etc': 'ethereum-classic',
  'algo': 'algorand',
  'xtz': 'tezos',
  'egld': 'elrond-erd-2',
  'theta': 'theta-token',
  'ftm': 'fantom',
  'hbar': 'hedera-hashgraph',
  'flow': 'flow',
  'eos': 'eos',
  'xmr': 'monero',
  'bsv': 'bitcoin-sv',
  'neo': 'neo',
  'klay': 'klaytn',
  'cake': 'pancakeswap-token',
  'aave': 'aave',
  'mkr': 'maker',
  'comp': 'compound-governance-token',
  'sushi': 'sushi',
  'snx': 'havven',
  'crv': 'curve-dao-token',
  'yfi': 'yearn-finance',
  'uma': 'uma',
  'bal': 'balancer',
  'lrc': 'loopring',
  'zrx': '0x',
  'knc': 'kyber-network-crystal',
  'bat': 'basic-attention-token',
  'zil': 'zilliqa',
  'icx': 'icon',
  'omg': 'omisego',
  'qtum': 'qtum',
  'zec': 'zcash',
  'dcr': 'decred',
  'dash': 'dash',
  'waves': 'waves',
  'nano': 'nano',
  'xem': 'nem',
  'lsk': 'lisk',
  'ardr': 'ardor',
  'strat': 'stratis',
  'rep': 'augur',
  'gnt': 'golem',
  'sc': 'siacoin',
  'dgb': 'digibyte',
  'dent': 'dent',
  'rdd': 'reddcoin',
  'xvg': 'verge',
  'maid': 'maidsafecoin',
  'storj': 'storj',
  'btg': 'bitcoin-gold',
  'xrp': 'ripple',
  'bnb': 'binancecoin',
  'usdt': 'tether',
  'usdc': 'usd-coin',
  'busd': 'binance-usd',
  'dai': 'dai',
  'tusd': 'true-usd',
  'pax': 'paxos-standard',
  'gusd': 'gemini-dollar',
  'husd': 'husd',
  'usdk': 'usdk',
  'usdp': 'paxos-standard',
  'frax': 'frax',
  'lusd': 'liquity-usd',
  'fei': 'fei-usd',
  'tribe': 'tribe',
  'rai': 'rai',
  'ohm': 'olympus',
  'time': 'wonderland',
  'memo': 'wonderland',
  'klima': 'klima-dao',
  'bct': 'toucan-protocol-base-carbon-tonne',
  'mco2': 'moss-carbon-credit',
  'nct': 'toucan-protocol-nature-carbon-tonne',
  'ust': 'terrausd',
  'luna': 'terra-luna',
  'anc': 'anchor-protocol',
  'mir': 'mirror-protocol',
  'mina': 'mina-protocol',
  'near': 'near',
  'rose': 'oasis-network',
  'ar': 'arweave',
  'grt': 'the-graph',
  'lpt': 'livepeer',
  'api3': 'api3',
  'band': 'band-protocol',
  'ocean': 'ocean-protocol',
  'fet': 'artificial-superintelligence-alliance',
  'agi': 'singularitynet',
  'rndr': 'render-token',
  'ankr': 'ankr',
  'ctsi': 'cartesi',
  'skl': 'skale',
  'nu': 'nucypher',
  'keep': 'keep-network',
  'rpl': 'rocket-pool',
  'ldo': 'lido-dao',
  'fxs': 'frax-share',
  'cvx': 'convex-finance',
  'spell': 'spell-token',
  'ice': 'ice-token',
  'mim': 'magic-internet-money',
  'joe': 'joe',
  'png': 'pangolin',
  'qi': 'benqi',
  'xava': 'avalaunch',
  'pefi': 'penguin-finance',
  'snob': 'snowball-token',
  'teddy': 'teddy-cash',
  'yak': 'yield-yak',
  'lydia': 'lydia-finance',
  'olive': 'olive-cash',
  'elk': 'elk-finance',
  'gmx': 'gmx',
  'magic': 'magic',
  'dpx': 'dopex',
  'rdnt': 'radiant-capital',
  'arb': 'arbitrum',
  'op': 'optimism',
  'blur': 'blur',
  'pepe': 'pepe',
  'inj': 'injective-protocol',
  'sei': 'sei-network',
  'aptos': 'aptos',
  'sui': 'sui',
  'kas': 'kaspa',
  'rune': 'thorchain',
  'osmo': 'osmosis',
  'juno': 'juno-network',
  'scrt': 'secret',
  'kava': 'kava',
  'cro': 'crypto-com-chain',
  'ftx': 'ftx-token',
  'ftt': 'ftx-token',
  'ray': 'raydium',
  'srm': 'serum',
  'cope': 'cope',
  'media': 'media-network',
  'rope': 'rope-token',
  'mngo': 'mango-markets',
  'tulip': 'tulip-protocol',
  'orca': 'orca',
  'samo': 'samoyedcoin',
  'bonk': 'bonk',
  'wif': 'dogwifcoin',
  'jup': 'jupiter-exchange-solana',
  'pyth': 'pyth-network',
  'jito': 'jito-governance-token',
  'render': 'render-token',
  'wld': 'worldcoin-wld',
  'tia': 'celestia',
  'dym': 'dymension',
  'ordi': 'ordi',
  'sats': '1000sats',
  'rats': 'rats',
  'pups': 'bitcoin-puppets',
  'node': 'nodeai',
  'meme': 'memecoin',
  'neiro': 'neiro',
  'goat': 'goatseus-maximus',
  'pnut': 'peanut-the-squirrel',
  'act': 'act-i-the-ai-prophecy',
  'pump': 'pump-fun',
  'virtual': 'virtual-protocol',
  'ai16z': 'ai16z',
  'zerebro': 'zerebro',
  'griffain': 'griffain',
  'fai': 'fai',
  'truth': 'truth-terminal',
  'wluna': 'wrapped-luna-token',
  'lunc': 'terra-luna-classic',
  'ustc': 'terrausd-classic',
  'wormhole': 'wormhole',
  'w': 'wormhole',
  'pendle': 'pendle',
  'ena': 'ethena',
  'not': 'notcoin',
  'dogs': 'dogs',
  'ton': 'the-open-network',
  'hmstr': 'hamster-kombat',
  'cati': 'catizen',
  'ntrn': 'neutron',
  'tao': 'bittensor',
  'arkm': 'arkham',
  'rlb': 'rollbit-coin',
  'mana': 'decentraland',
  'sand': 'the-sandbox',
  'axs': 'axie-infinity',
  'slp': 'smooth-love-potion',
  'ron': 'ronin',
  'pixel': 'pixels',
  'prime': 'echelon-prime',
  'gala': 'gala',
  'enj': 'enjincoin',
  'chr': 'chromaway',
  'alice': 'myneighboralice',
  'tlm': 'alien-worlds',
  'imx': 'immutable-x',
  'gods': 'gods-unchained',
  'mc': 'merit-circle',
  'ghst': 'aavegotchi',
  'revv': 'revv',
  'star': 'starlink',
  'dego': 'dego-finance',
  'doki': 'doki-doki-finance',
  'nft': 'nft-index',
  'whale': 'whale',
  'audio': 'audius',
  'super': 'superfarm',
  'rare': 'superrare',
  'looks': 'looksrare',
  'x2y2': 'x2y2',
  'dydx': 'dydx',
  'perp': 'perpetual-protocol',
  'mcdex': 'mcdex',
  'hegic': 'hegic',
  'opyn': 'opyn-squeeth',
  'ribbon': 'ribbon-finance',
  'euler': 'euler',
  'temple': 'temple-dao',
  'fpis': 'frax-price-index-share',
  'alcx': 'alchemix',
  'aleth': 'alchemix-eth',
  'alusd': 'alchemix-usd',
  'mimo': 'mimo-parallel-governance-token',
  'mta': 'meta',
  'musd': 'musd',
  'rgt': 'rari-governance-token',
  'badger': 'badger-dao',
  'digg': 'digg',
  'bor': 'boringdao',
  'for': 'forta',
  'radar': 'dappradar',
  'superfluid': 'superfluid',
  'pool': 'pooltogether',
  'dpi': 'defipulse-index',
  'mvi': 'metaverse-index',
  'bed': 'bankless-bed-index',
  'data': 'data-economy-index',
  'gmi': 'bankless-defi-innovation-index',
  'fli': 'eth-2x-flexible-leverage-index',
  'index': 'index-cooperative',
  'inv': 'inverse-finance',
  'dola': 'dola-usd',
  'cream': 'cream-2',
  'alpha': 'alpha-finance',
  'ibeth': 'interest-bearing-eth',
  'beta': 'beta-finance',
  'bnt': 'bancor',
  'vbnt': 'bancor-governance-token',
  'lqty': 'liquity',
  'mpl': 'maple',
  'syrup': 'maple-syrup',
  'trb': 'tellor',
  'tru': 'truefi',
  'hex': 'hex',
  'stake': 'xdai-stake',
  'rook': 'rook',
  'torn': 'tornado-cash',
  'rail': 'railgun',
  'aztec': 'aztec-protocol',
  'zkp': 'panther-protocol',
  'zksync': 'zksync',
  'starknet': 'starknet',
  'polygon': 'matic-network',
  'one': 'harmony',
  'movr': 'moonriver',
  'glmr': 'moonbeam',
  'ksm': 'kusama',
  'rmrk': 'rmrk',
  'kar': 'karura',
  'pha': 'pha',
  'sdn': 'shiden',
  'astr': 'astar',
  'bnc': 'bifrost-native-coin',
  'para': 'parachain-slot-auction',
  'lksm': 'liquid-kusama',
  'vsksm': 'voucher-kusama',
  'taiga': 'taiga-protocol',
  'bsx': 'basilisk',
  'teer': 'integritee',
  'kint': 'kintsugi',
  'kico': 'kico',
  'crab': 'darwinia-crab-network',
  'ring': 'darwinia-network-native-token',
  'kton': 'darwinia-commitment-token',
  'pkf': 'polkafoundry',
  'red': 'redstone',
  'polis': 'star-atlas-polis',
  'atlas': 'star-atlas',
  'fida': 'bonfida',
  'kin': 'kin',
  'maps': 'maps',
  'o': 'oxygen',
  'port': 'port-finance',
  'slnd': 'solend',
  'mnde': 'marinade',
  'msol': 'marinade-staked-sol',
  'socn': 'socialcoin',
  'saber': 'saber',
  'sbr': 'saber',
  'sunny': 'sunny-aggregator',
  'step': 'step-finance',
  'alph': 'alephium',
  'lyx': 'lukso-token',
  'ever': 'everscale',
  'gram': 'gram',
  'durov': 'durov',
  'scale': 'scale-network',
  'velas': 'velas',
  'vlx': 'velas',
  'wag': 'wag',
  'aurora': 'aurora-near',
  'tri': 'trisolaris',
  'bstn': 'bastion-protocol',
  'linear': 'linear',
  'ref': 'ref-finance',
  'paras': 'paras',
  'skyward': 'skyward-finance',
  'meta': 'metapool',
  'stnear': 'staked-near',
  'oct': 'octopus-network',
  'pulse': 'pulse-network',
  'pls': 'pulsechain',
  'plsx': 'pulsex',
  'inc': 'inc4',
  'sacrifice': 'sacrifice',
  'bear': 'bear-token',
  'wpls': 'wrapped-pulse'
}

/**
 * Attempts to resolve a user-friendly coin name to a proper CoinGecko ID
 */
function resolveCoinId(input: string): string {
  const normalized = input.toLowerCase().trim()
  
  // Check direct mappings first
  if (COIN_ID_MAPPINGS[normalized]) {
    return COIN_ID_MAPPINGS[normalized]
  }
  
  // Check if it's already a valid coin ID format
  if (/^[a-z0-9-]+$/.test(normalized)) {
    return normalized
  }
  
  // Try to clean up the input
  const cleaned = normalized.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  
  if (cleaned && cleaned.length > 0) {
    return cleaned
  }
  
  // Fallback to the original normalized input
  return normalized
}

/**
 * Searches for a coin by name using CoinGecko search API
 */
async function searchCoinId(query: string): Promise<string | null> {
  const apiKey = process.env.COINGECKO_API_KEY
  const baseUrl = 'https://api.coingecko.com/api/v3'
  const url = `${baseUrl}/search`
  const params = new URLSearchParams({
    query: query.trim(),
    ...(apiKey && { 'x-cg-demo-api-key': apiKey })
  })

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Jarvis-Investment-Agent/1.0',
        ...(apiKey && { 'x-cg-demo-api-key': apiKey })
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (data.coins && data.coins.length > 0) {
      // Return the first match
      return data.coins[0].id
    }
    
    return null
  } catch (error) {
    console.error('Error searching for coin:', error)
    return null
  }
}

/**
 * Robust market chart fetching with fallback mechanisms
 */
export async function fetchMarketChartWithFallback(
  coinId: string,
  days: number = 7,
  currency: string = 'usd'
): Promise<MarketChartResponse> {
  // First, try to resolve the coin ID
  let resolvedCoinId = resolveCoinId(coinId)
  
  try {
    // Try with the resolved coin ID first
    return await fetchMarketChart(resolvedCoinId, days, currency)
  } catch (error: any) {
    console.log(`Failed to fetch with resolved ID "${resolvedCoinId}": ${error.message}`)
    
    // If it's a 404 error, try searching for the coin
    if (error.message.includes('404')) {
      console.log(`Searching for coin with query: "${coinId}"`)
      const searchResult = await searchCoinId(coinId)
      
      if (searchResult && searchResult !== resolvedCoinId) {
        console.log(`Found alternative coin ID: "${searchResult}"`)
        try {
          return await fetchMarketChart(searchResult, days, currency)
        } catch (searchError: any) {
          console.log(`Failed to fetch with search result "${searchResult}": ${searchError.message}`)
        }
      }
    }
    
    // If original coin ID is different from resolved, try the original
    if (coinId !== resolvedCoinId) {
      const originalSanitized = sanitizeCoinId(coinId)
      if (originalSanitized !== resolvedCoinId) {
        console.log(`Trying with original sanitized ID: "${originalSanitized}"`)
        try {
          return await fetchMarketChart(originalSanitized, days, currency)
        } catch (originalError: any) {
          console.log(`Failed to fetch with original ID "${originalSanitized}": ${originalError.message}`)
        }
      }
    }
    
    // All fallbacks failed, throw the original error
    throw error
  }
}

/**
 * Convenience function to get processed market data for the last 7 days (hourly)
 * @param coinId - The CoinGecko coin ID
 * @param currency - Target currency (default: 'usd')
 * @returns Promise<ProcessedMarketData>
 */
export async function getHourlyMarketData(
  coinId: string,
  currency: string = 'usd'
): Promise<ProcessedMarketData> {
  const days = 7 // Last 7 days gives hourly data
  const rawData = await fetchMarketChartWithFallback(coinId, days, currency)
  return processMarketChartData(rawData, coinId, currency, days)
}

/**
 * Formats timestamp to human-readable date string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

/**
 * Formats price with appropriate decimal places
 * @param price - Price value
 * @returns Formatted price string
 */
export function formatPrice(price: number): string {
  if (price >= 100) {
    return price.toFixed(2)
  } else if (price >= 1) {
    return price.toFixed(4)
  } else {
    return price.toPrecision(4)
  }
}

/**
 * Formats market cap or volume with appropriate units
 * @param value - Market cap or volume value
 * @returns Formatted string with units
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

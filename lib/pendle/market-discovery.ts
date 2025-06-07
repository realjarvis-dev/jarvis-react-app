import { ethers } from 'ethers'
import { getConfigByChainId } from '../network/config'

// PendleData ABI (minimal interface for market discovery)
const PENDLE_DATA_ABI = [
  'function getAllMarkets(address underlying) external view returns (address[] memory)',
  'function marketOfMarketFactory(address underlying, address yieldToken) external view returns (address)'
]

// Pendle Market ABI (minimal interface for market details)
const PENDLE_MARKET_ABI = [
  'function SY() external view returns (address)',
  'function PT() external view returns (address)',
  'function YT() external view returns (address)',
  'function readTokens() external view returns (address, address, address)',
  'function getMarketName() external view returns (string)'
]

// ERC20 ABI for token details
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
]

// Mapping of chainId to PendleData contract address
const PENDLE_DATA_ADDRESSES: Record<number, string> = {
  1: '0x0Db5233f79A4F5038E1a0F1D4038f8E45f7a4Bad', // Ethereum Mainnet
  42161: '0x0Db5233f79A4F5038E1a0F1D4038f8E45f7a4Bad', // Arbitrum
  43114: '0x0Db5233f79A4F5038E1a0F1D4038f8E45f7a4Bad', // Avalanche
  // Add more chains as needed
}

/**
 * Finds the Pendle market address for a given token
 * @param tokenAddress The address of the token to find market for
 * @param chainId The chain ID (default: 1 for Ethereum Mainnet)
 * @param isDemo Whether this is running in demo mode
 * @returns The market address if found, null otherwise
 */
export async function findPendleMarketAddress(
  tokenAddress: string,
  chainId: number = 1,
  isDemo: boolean = false
): Promise<string | null> {
  try {
    // Get the PendleData contract address for this chain
    const pendleDataAddress = PENDLE_DATA_ADDRESSES[chainId]
    if (!pendleDataAddress) {
      throw new Error(`No PendleData contract address available for chain ID ${chainId}`)
    }

    // Create a provider
    const provider = new ethers.JsonRpcProvider(
      getConfigByChainId(chainId, isDemo).rpcUrl
    )

    // Create a contract instance
    const pendleDataContract = new ethers.Contract(
      pendleDataAddress,
      PENDLE_DATA_ABI,
      provider
    )

    // Call getAllMarkets to get an array of market addresses
    const markets = await pendleDataContract.getAllMarkets(tokenAddress.toLowerCase())

    // If no markets found, return null
    if (!markets || markets.length === 0) {
      return null
    }

    // Return the first market found (could be enhanced to select based on TVL, etc.)
    return markets[0]
  } catch (error) {
    console.error('Error finding Pendle market address:', error)
    return null
  }
}

/**
 * Finds Pendle market and token (PT/YT) addresses for a given token
 * @param tokenAddress The address of the token to find market for
 * @param chainId The chain ID (default: 1 for Ethereum Mainnet)
 * @param isDemo Whether this is running in demo mode
 * @returns Object containing market address and token info if found, null otherwise
 */
export async function getPendleMarketInfo(
  tokenAddress: string,
  chainId: number = 1,
  isDemo: boolean = false
): Promise<{
  marketAddress: string,
  ptAddress: string,
  ytAddress: string,
  name: string
} | null> {
  try {
    // First, find the market address
    const marketAddress = await findPendleMarketAddress(tokenAddress, chainId, isDemo)
    if (!marketAddress) {
      return null
    }

    // Create a provider
    const provider = new ethers.JsonRpcProvider(
      getConfigByChainId(chainId, isDemo).rpcUrl
    )

    // Create a contract instance for the market
    const marketContract = new ethers.Contract(
      marketAddress,
      PENDLE_MARKET_ABI,
      provider
    )

    // Get token addresses from the market contract
    let ptAddress, ytAddress
    try {
      // Try the readTokens function first (newer markets)
      const [syAddress, ptAddr, ytAddr] = await marketContract.readTokens()
      ptAddress = ptAddr
      ytAddress = ytAddr
    } catch (error) {
      // Fallback to individual calls for older markets
      try {
        ptAddress = await marketContract.PT()
        ytAddress = await marketContract.YT()
      } catch (error) {
        console.error('Error fetching token addresses from market:', error)
        return null
      }
    }

    // Get market name
    let name = 'Pendle Market'
    try {
      name = await marketContract.getMarketName()
    } catch (error) {
      // If getMarketName fails, try to extract from tokenAddress symbol
      // This is a fallback and might not be accurate
      console.warn('Could not get market name, using default')
    }

    return {
      marketAddress,
      ptAddress,
      ytAddress,
      name
    }
  } catch (error) {
    console.error('Error getting Pendle market info:', error)
    return null
  }
}

/**
 * Gets token details from an ERC20 token address
 * @param tokenAddress The token address
 * @param chainId The chain ID
 * @param isDemo Whether this is running in demo mode
 * @returns Promise with token name, symbol, and decimals
 */
export async function getTokenDetails(
  tokenAddress: string,
  chainId: number = 1,
  isDemo: boolean = false
): Promise<{
  name: string,
  symbol: string,
  decimals: number
} | null> {
  try {
    // Create a provider
    const provider = new ethers.JsonRpcProvider(
      getConfigByChainId(chainId, isDemo).rpcUrl
    )

    // Create a contract instance
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    )

    // Get token details
    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name().catch(() => 'Unknown Token'),
      tokenContract.symbol().catch(() => 'UNKNOWN'),
      tokenContract.decimals().catch(() => 18)
    ])

    return {
      name,
      symbol,
      decimals: Number(decimals)
    }
  } catch (error) {
    console.error('Error getting token details:', error)
    return null
  }
} 
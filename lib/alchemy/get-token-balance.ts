import { Alchemy, TokenBalance } from 'alchemy-sdk'
import { ethers } from 'ethers'
import { TenderlyDemoConfig } from '../config/network'
import {
  berachainBepoliaAlchemy,
  berachainMainnetAlchemy,
  mainnetAlchemy,
  sepoliaAlchemy
} from './client'
import { nativeAssets } from './native-asset-mapping'
import { TokenData } from './types'

export async function getMainnetTokenBalance(
  address: string
): Promise<TokenData[]> {
  return getTokenBalance(address, mainnetAlchemy)
}

export async function getSepoliaTokenBalance(
  address: string
): Promise<TokenData[]> {
  return getTokenBalance(address, sepoliaAlchemy)
}

export async function getBerachainMainnetTokenBalance(
  address: string
): Promise<TokenData[]> {
  return getTokenBalance(address, berachainMainnetAlchemy)
}

export async function getBerachainBepoliaTokenBalance(
  address: string
): Promise<TokenData[]> {
  return getTokenBalance(address, berachainBepoliaAlchemy)
}

/**
 * Get token balances from Tenderly Demo Network (vnet)
 * Uses direct RPC calls since Alchemy doesn't support custom networks
 */
export async function getTenderlyDemoTokenBalance(
  address: string
): Promise<TokenData[]> {
  try {
    const provider = new ethers.JsonRpcProvider(TenderlyDemoConfig.rpcUrl);
    
    // Get native ETH balance
    const nativeBalance = await provider.getBalance(address);
    
    const ethToken: TokenData = {
      address: ethers.ZeroAddress,
      name: 'Ether',
      symbol: 'ETH',
      balance: ethers.formatEther(nativeBalance),
      network: 'Tenderly Demo Network'
    };

    return [ethToken];
  } catch (error) {
    console.error('Error fetching Tenderly demo balances:', error);
    return [];
  }
}

export async function getTokenBalance(
  address: string,
  alchemy: Alchemy = mainnetAlchemy
): Promise<TokenData[]> {
  try {
    // Initialize erc20 outside the inner try block
    let erc20: TokenData[] = []

    try {
      /* ── 1. ERC-20 balances ─────────────────────────────────────────── */
      const { tokenBalances } = await alchemy.core.getTokenBalances(address)
      /* ── 2. Keep only non-zero balances ─────────────────────────────── */
      const nonZero = tokenBalances.filter(
        (tb: TokenBalance) => BigInt(tb.tokenBalance || '0x0') !== BigInt(0)
      )

      /* ── 3. Get metadata for each token ─────────────────────────────── */
      const metaPromises = nonZero.map(tb =>
        alchemy.core.getTokenMetadata(tb.contractAddress)
      )
      const metas = await Promise.all(metaPromises)

      /* ── 4. Format ERC-20 balances ──────────────────────────────────── */
      erc20 = nonZero.map((tb, i) => {
        const meta = metas[i]
        const rawBig = BigInt(tb.tokenBalance || '0x0')
        return {
          address: tb.contractAddress,
          name: meta.name ?? 'Unknown',
          symbol: meta.symbol ?? 'UNK',
          balance: ethers.formatUnits(rawBig, meta.decimals ?? 18),
          network: alchemy.config.network
        }
      })
    } catch (err) {
      console.log('Error in getTokenBalance:', err)
      // No need to reassign erc20 as it's already initialized as an empty array
    }

    /* ── 5. Native ETH balance ──────────────────────────────────────── */
    const nativeWei = await alchemy.core.getBalance(address, 'latest')

    const ethToken: TokenData = {
      address: ethers.ZeroAddress, // 0x000…000
      name: nativeAssets[alchemy.config.network].name,
      symbol: nativeAssets[alchemy.config.network].symbol,
      balance: ethers.formatEther(nativeWei.toString()),
      network: alchemy.config.network
    }

    /* ── 6. Combine and return ──────────────────────────────────────── */
    return [ethToken, ...erc20]
  } catch (err) {
    console.log('Error in getTokenBalance:', err)
    return []
  }
}

const tokenBalanceFunctions = [
  getMainnetTokenBalance,
  getSepoliaTokenBalance,
  getBerachainMainnetTokenBalance,
  getBerachainBepoliaTokenBalance,
  getTenderlyDemoTokenBalance // Add Tenderly demo network support
]

export default tokenBalanceFunctions

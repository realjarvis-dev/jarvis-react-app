import { Alchemy, TokenBalance } from 'alchemy-sdk'
import { ethers } from 'ethers'
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
  getBerachainBepoliaTokenBalance
]

export default tokenBalanceFunctions

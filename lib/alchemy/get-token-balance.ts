import { Alchemy, TokenBalance } from 'alchemy-sdk'
import { ethers } from 'ethers'
import { TenderlyDemoConfig } from '../config/network'
import {
  berachainBepoliaAlchemy,
  berachainMainnetAlchemy,
  chainIdToAlchemyClient,
  mainnetAlchemy,
  sepoliaAlchemy
} from './client'
import { nativeAssets } from './native-asset-mapping'
import { TokenData } from './types'

export async function getMainnetTokenBalance(
  walletAddress: string
): Promise<TokenData[]> {
  return getTokenBalance(walletAddress, mainnetAlchemy)
}

export async function getSepoliaTokenBalance(
  walletAddress: string
): Promise<TokenData[]> {
  return getTokenBalance(walletAddress, sepoliaAlchemy)
}

export async function getBerachainMainnetTokenBalance(
  walletAddress: string
): Promise<TokenData[]> {
  return getTokenBalance(walletAddress, berachainMainnetAlchemy)
}

export async function getBerachainBepoliaTokenBalance(
  walletAddress: string
): Promise<TokenData[]> {
  return getTokenBalance(walletAddress, berachainBepoliaAlchemy)
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
  walletAddress: string,
  alchemy: Alchemy = mainnetAlchemy
): Promise<TokenData[]> {
  try {
    // Initialize erc20 outside the inner try block
    let erc20: TokenData[] = []

    try {
      /* ── 1. ERC-20 balances ─────────────────────────────────────────── */
      const { tokenBalances } = await alchemy.core.getTokenBalances(walletAddress)
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
    const nativeWei = await alchemy.core.getBalance(walletAddress, 'latest')

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

export async function getTokenBalanceByChainId(
  walletAddress: string,
  chainId: number
): Promise<TokenData[]> {
  return getTokenBalance(walletAddress, chainIdToAlchemyClient[chainId])
}

export async function getNativeBalanceByChainId(walletAddress: string, chainId: number): Promise<number> {
  const alchemy = chainIdToAlchemyClient[chainId]
  const nativeWei = await alchemy.core.getBalance(walletAddress, 'latest')

  return Number(ethers.formatEther(nativeWei.toString()))
}

console.log(await getNativeBalanceByChainId('0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8', 80094))

export default tokenBalanceFunctions

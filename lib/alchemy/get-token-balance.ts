import { TokenBalance } from 'alchemy-sdk';
import { ethers } from "ethers";
import { alchemy } from './client';

export interface TokenData {
  address: string;
  name:    string;
  symbol:  string;
  balance: string;      // human-readable
}

export async function getTokenBalance(address: string): Promise<TokenData[]> {
  try {
    /* ── 1. ERC-20 balances ─────────────────────────────────────────── */
    const { tokenBalances }  = await alchemy.core.getTokenBalances(
      address
    );

    /* ── 2. Keep only non-zero balances ─────────────────────────────── */
    const nonZero = tokenBalances.filter(
      (tb: TokenBalance) => BigInt(tb.tokenBalance || "0x0") !== BigInt(0)
    );

    /* ── 3. Get metadata for each token ─────────────────────────────── */
    const metaPromises = nonZero.map(tb => 
      alchemy.core.getTokenMetadata(tb.contractAddress)
    );
    const metas = await Promise.all(metaPromises);

    /* ── 4. Format ERC-20 balances ──────────────────────────────────── */
    const erc20: TokenData[] = nonZero.map((tb, i) => {
      const meta   = metas[i];
      const rawBig = BigInt(tb.tokenBalance || "0x0");
      return {
        address : tb.contractAddress,
        name    : meta.name    ?? "Unknown",
        symbol  : meta.symbol  ?? "UNK",
        balance : ethers.formatUnits(rawBig, meta.decimals ?? 18)
      };
    });

    /* ── 5. Native ETH balance ──────────────────────────────────────── */
    const nativeWei = await alchemy.core.getBalance(address, "latest");
    const ethToken: TokenData = {
      address : ethers.ZeroAddress,     // 0x000…000
      name    : "Ether",
      symbol  : "ETH",
      balance : ethers.formatEther(nativeWei.toString())
    };

    /* ── 6. Combine and return ──────────────────────────────────────── */
    return [ethToken, ...erc20];
  } catch (err) {
    console.error("Error in getTokenBalance:", err);
    return [];
  }
}

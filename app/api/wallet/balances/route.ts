import { getWalletBalances } from '@/lib/utils/wallet';
import { NextRequest, NextResponse } from 'next/server';
import { getUserEvmWalletAddress, getUserSolWalletAddress, getUserWallet, privy } from "@/lib/privy/client";

export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query parameter if provided
    // const searchParams = request.nextUrl.searchParams;
    // const walletAddress = searchParams.get('address') || undefined;
    const walletAddress = await getUserEvmWalletAddress()
    
    const balances = await getWalletBalances(walletAddress);
  
    return NextResponse.json(balances);
  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet balances' },
      { status: 500 }
    );
  }
} 
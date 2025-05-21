import { getIslandInfo, investInKodiakIsland } from '@/lib/kodiak/transactions';
import { getUserEvmWalletAddress } from '@/lib/privy/client';
import { ethers } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Input validation schema
const InvestRequestSchema = z.object({
  islandAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid island address format'),
  amount: z.string()
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a valid number'),
  slippage: z.number()
    .min(0.01, 'Slippage must be at least 0.01%')
    .max(10, 'Slippage cannot exceed 10%')
    .optional()
    .default(0.5),
  network: z.enum(['bepolia', 'mainnet'])
    .optional()
    .default('mainnet')
});

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const userAddress = await getUserEvmWalletAddress();
    if (!userAddress) {
      return NextResponse.json(
        { error: 'User not authenticated or wallet not connected' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate input
    const result = InvestRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.format() },
        { status: 400 }
      );
    }
    
    const { islandAddress, amount, slippage, network } = result.data;
    
    // Convert amount to wei
    const amountInWei = ethers.parseEther(amount).toString();
    
    // Get island information for display
    const islandInfo = await getIslandInfo(islandAddress, network);
    
    // Execute the investment
    const { hash } = await investInKodiakIsland(
      islandAddress,
      amountInWei,
      slippage,
      network
    );
    
    // Return success response with transaction hash
    return NextResponse.json({
      success: true,
      hash,
      islandInfo,
      details: {
        amount,
        amountInWei,
        islandAddress,
        network
      }
    });
  } catch (error: any) {
    console.error('Error in /api/kodiak/invest:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to invest in Kodiak Island',
        success: false
      },
      { status: 500 }
    );
  }
}

// GET method to fetch island info
export async function GET(request: NextRequest) {
  try {
    // Get the island address from the URL query parameters
    const { searchParams } = new URL(request.url);
    const islandAddress = searchParams.get('islandAddress');
    const network = (searchParams.get('network') as 'bepolia' | 'mainnet') || 'mainnet';
    
    // Validate island address
    if (!islandAddress || !/^0x[a-fA-F0-9]{40}$/.test(islandAddress)) {
      return NextResponse.json(
        { error: 'Invalid island address' },
        { status: 400 }
      );
    }
    
    // Get island information
    const islandInfo = await getIslandInfo(islandAddress, network);
    
    // Return the island information
    return NextResponse.json({
      success: true,
      islandInfo
    });
  } catch (error: any) {
    console.error('Error fetching island info:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch island information',
        success: false
      },
      { status: 500 }
    );
  }
} 
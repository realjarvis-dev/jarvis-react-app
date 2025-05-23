import { DepositParams, depositToKodiakIsland } from '@/lib/kodiak/islandRatio';
import { verifyAccessToken } from '@/lib/privy/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== API: Starting Kodiak deposit request ===');
    
    // Verify user is authenticated
    try {
      await verifyAccessToken();
      console.log('=== API: User authentication successful ===');
    } catch (error) {
      console.error('=== API: Authentication failed ===', error);
      return NextResponse.json(
        { status: 'fail', error_message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse the deposit parameters from the request body
    const depositParams = await request.json() as DepositParams;
    console.log('=== API: Received deposit parameters ===', depositParams);
    
    // Validate parameters
    if (!depositParams.islandAddress || !depositParams.totalAmount || depositParams.slippageBPS === undefined || !depositParams.minSharesReceived) {
      console.error('=== API: Missing required parameters ===', depositParams);
      return NextResponse.json(
        { status: 'fail', error_message: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Execute the deposit
    console.log('=== API: Executing deposit with parameters ===', depositParams);
    try {
      const result = await depositToKodiakIsland(depositParams);
      console.log('=== API: Deposit execution completed ===', result);
      
      // Return the result
      return NextResponse.json(result);
    } catch (depositError) {
      console.error('=== API: Error in depositToKodiakIsland ===');
      console.error('Error type:', typeof depositError);
      console.error('Error details:', depositError);
      
      if (depositError instanceof Error) {
        console.error('Error name:', depositError.name);
        console.error('Error message:', depositError.message);
        console.error('Error stack:', depositError.stack);
      }
      
      throw depositError;
    }
  } catch (error) {
    console.error('=== API: Unhandled error in deposit API ===');
    console.error('Error type:', typeof error);
    
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Non-Error object:', error);
    }
    
    return NextResponse.json(
      { 
        status: 'fail', 
        error_message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
} 
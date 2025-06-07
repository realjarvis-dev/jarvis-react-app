import axios from 'axios'
import { ethers } from 'ethers'
import { getUserEvmWalletAddress } from '../privy/client'
import { SimplifiedPendleMarket } from '../types/pendle'
import { getPendleMarketInfo } from './market-discovery'

// Define the quote response type from the API
export interface SwapQuoteResponse {
  data: {
    amountOut: string
    priceImpact: number
  }
}

// Define a more user-friendly quote result with formatted values
export interface FormattedQuote {
  inputAmount: string
  inputToken: string
  outputAmount: string
  outputToken: string
  rate: string
  inverse: string
}

// Native ETH is represented by the zero address in the Pendle API
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000"

// API base URL
const BASE_URL = 'https://api-v2.pendle.finance/core/v1'

/**
 * Get a quote for swapping between ETH and PT/YT tokens
 * This enhanced version can work directly with token addresses by discovering the market on-the-fly
 * @param marketOrToken The Pendle market or market address or token address
 * @param tokenAddress Optional token address when marketOrToken is a market
 * @param marketName Optional market name for display purposes
 * @param amountIn Amount to swap (in ETH or token units)
 * @param direction 'ethToToken' or 'tokenToEth' to specify swap direction
 * @param chainId Chain ID (default: 1 for Ethereum Mainnet)
 * @param isDemo Whether this is running in demo mode
 * @returns Promise with the formatted quote
 * @throws Error if API call fails or returns invalid data
 */
export async function getQuote(
  marketOrToken: SimplifiedPendleMarket | string,
  tokenAddress?: string,
  marketName?: string,
  amountIn: string = "1",
  direction: 'ethToToken' | 'tokenToEth' = 'ethToToken',
  chainId: number = 1,
  isDemo: boolean = false
): Promise<FormattedQuote> {
  try {
    let marketAddress: string;
    let token: string;
    let displayName = marketName || 'Unknown Market';
    
    // Determine if we're given a market or a token
    if (typeof marketOrToken === 'string' && (!tokenAddress || tokenAddress === '')) {
      // If only a string is provided without a token address, assume it's a token
      // and try to discover its market
      const marketInfo = await getPendleMarketInfo(marketOrToken, chainId, isDemo);
      if (!marketInfo) {
        throw new Error(`No Pendle market found for token: ${marketOrToken}`);
      }
      
      // Use discovered market info
      marketAddress = marketInfo.marketAddress;
      token = direction === 'ethToToken' ? marketInfo.ptAddress : marketInfo.ytAddress; // Default to PT
      displayName = marketInfo.name;
    } else {
      // Handle the case when market/market address is explicitly provided
      marketAddress = typeof marketOrToken === 'string' ? marketOrToken : marketOrToken.address;
      
      // Ensure token address is provided
      if (!tokenAddress) {
        throw new Error('Token address is required when providing a market address');
      }
      token = tokenAddress;
    }
    
    // Convert amount to wei/token units (assuming 18 decimals for both)
    let amountInWei;
    try {
      amountInWei = ethers.parseEther(amountIn).toString();
    } catch (error) {
      throw new Error(`Invalid amount: ${amountIn}`);
    }
    
    const evmWalletAddress = await getUserEvmWalletAddress();
    if (!evmWalletAddress) {
      throw new Error('EVM wallet not found')
    }

    const RECEIVER = evmWalletAddress;
    
    // Format the URL
    const url = `${BASE_URL}/sdk/${chainId}/markets/${marketAddress}/swap`;
    
    // Set tokenIn and tokenOut based on direction
    const tokenIn = direction === 'ethToToken' ? ETH_ADDRESS : token;
    const tokenOut = direction === 'ethToToken' ? token : ETH_ADDRESS;
    
    // Create params object
    const params = {
      tokenIn,
      tokenOut,
      amountIn: amountInWei,
      slippage: 0.01,
      receiver: RECEIVER,
      enableAggregator: true,
      chainId: chainId,
      market: marketAddress
    };
    
    // Make API request with a timeout of 15 seconds
    const response = await axios.get(url, { 
      params,
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000 // 15 seconds timeout
    });
    
    // Validate response
    if (!response.data) {
      throw new Error('Empty response from Pendle API');
    }
    
    const quoteData = response.data as SwapQuoteResponse;
    
    // Extract amount out
    if (!quoteData.data || !quoteData.data.amountOut) {
      throw new Error('Invalid response format: missing amountOut');
    }
    
    const amountOut = quoteData.data.amountOut || "0";
    
    // Format the output amount
    const outputAmountBigInt = BigInt(amountOut);
    const outputDecimalAmount = ethers.formatUnits(outputAmountBigInt, 18);
    
    // Set token names based on direction
    const inputToken = direction === 'ethToToken' ? "ETH" : displayName;
    const outputToken = direction === 'ethToToken' ? displayName : "ETH";
    
    // Calculate exchange rates
    const inputAmountFloat = parseFloat(amountIn);
    const outputAmountFloat = parseFloat(outputDecimalAmount);
    const rate = (outputAmountFloat / inputAmountFloat).toFixed(6);
    const inverse = (inputAmountFloat / outputAmountFloat).toFixed(6);
    
    // Return formatted quote
    const result = {
      inputAmount: amountIn,
      inputToken,
      outputAmount: outputDecimalAmount,
      outputToken,
      rate: `1 ${inputToken} = ${rate} ${outputToken}`,
      inverse: `1 ${outputToken} = ${inverse} ${inputToken}`
    };
    
    return result;
  } catch (error: any) {
    throw error;
  }
}
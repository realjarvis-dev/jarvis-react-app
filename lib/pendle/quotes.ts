import axios from 'axios'
import { ethers } from 'ethers'
import { getUserEvmWalletAddress } from '../privy/client'
import { SimplifiedPendleMarket } from '../types/pendle'
import { getConfigByChainId } from '../network/config'

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
 * @param market The Pendle market or market address
 * @param token The PT/YT token address
 * @param chainId Chain ID (default: 1 for Ethereum Mainnet)
 * @param marketName Optional market name for display purposes
 * @param amountIn Amount to swap (in ETH or token units)
 * @param direction 'ethToToken' or 'tokenToEth' to specify swap direction
 * @param userWalletAddress User's wallet address for quote calculation
 * @returns Promise with the formatted quote
 * @throws Error if API call fails or returns invalid data
 */
export async function getQuote(
  market: SimplifiedPendleMarket | string,
  token: string,
  chainId: number,
  marketName?: string,
  amountIn: string = "1",
  direction: 'ethToToken' | 'tokenToEth' = 'ethToToken',
  userWalletAddress?: string
): Promise<FormattedQuote> {
  try {
    // Handle both market object and market address string
    const marketAddress = typeof market === 'string' ? market : market.address;
    
    // Use the provided market name directly - this should already include PT/YT prefix
    const displayName = marketName || 'Unknown Market';
    
    // Convert amount to wei/token units (assuming 18 decimals for both)
    let amountInWei;
    try {
      amountInWei = ethers.parseEther(amountIn).toString();
    } catch (error) {
      throw new Error(`Invalid amount: ${amountIn}`);
    }
    
    let RECEIVER: string;
    
    if (userWalletAddress) {
      // Use provided wallet address
      RECEIVER = userWalletAddress;
    } else {
      // Try to get user's wallet address
      const evmWalletAddress = await getUserEvmWalletAddress();
      if (evmWalletAddress) {
        RECEIVER = evmWalletAddress;
      } else {
        // Use a placeholder address for anonymous quotes (common practice)
        // This allows users to see quotes before connecting their wallet
        RECEIVER = '0x0000000000000000000000000000000000000001';
      }
    }
    
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
    
    const networkConfig = getConfigByChainId(chainId, false);
    const nativeTokenSymbol = networkConfig.nativeAsset.symbol;
    
    // Set token names based on direction
    const inputToken = direction === 'ethToToken' ? nativeTokenSymbol : displayName;
    const outputToken = direction === 'ethToToken' ? displayName : nativeTokenSymbol;
    
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

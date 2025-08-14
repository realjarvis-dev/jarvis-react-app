import axios from 'axios';

const HOSTED_SDK_URL = 'https://api-v2.pendle.finance/core/';
export const LIMIT_ORDER_URL = 'https://api-v2.pendle.finance/limit-order/'

//"tokenApprovals": [
    // {
    //     "token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    //     "amount": "100000000"
    //   }
    // ],
export type MethodReturnType<Data> = {
    tx: {
        data: string;
        to: string;
        value: string;
    };
    tokenApprovals?: {
        token: string;
        amount: string;
    }[];
    data: Data;
};

export async function callSDK<Data>(path: string, params: Record<string, any> = {}) {
    try {
        const response = await axios.get<MethodReturnType<Data>>(HOSTED_SDK_URL + path, {
            params
        });

        return response.data;
    } catch (error: any) {
        // Handle specific Pendle API errors
        if (error.response?.data?.message) {
            const errorMessage = error.response.data.message;
            
            // Check for unhealthy feed error
            if (errorMessage.includes('feed is unhealthy') || errorMessage.includes('DF: feed is unhealthy')) {
                throw new Error('Price oracle feed is currently unhealthy. This is a safety mechanism to prevent trades during unreliable market conditions. Please try again later or use an alternative DEX.');
            }
            
            // Check for other common Pendle errors
            if (errorMessage.includes('insufficient liquidity')) {
                throw new Error('Insufficient liquidity for this trade. Try reducing the amount or check back later.');
            }
            
            if (errorMessage.includes('slippage')) {
                throw new Error('Trade exceeds slippage tolerance. Try increasing slippage or reducing trade size.');
            }
            
            throw new Error(`Pendle API error: ${errorMessage}`);
        }
        
        // Handle network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error('Unable to connect to Pendle API. Please check your internet connection and try again.');
        }
        
        // Handle timeout errors
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request to Pendle API timed out. Please try again.');
        }
        
        // Generic error fallback
        throw new Error(`Failed to fetch data from Pendle API: ${error.message}`);
    }
}

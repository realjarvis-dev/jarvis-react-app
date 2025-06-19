import { executeTransaction } from "../privy/utils";
import { callSDK, MethodReturnType } from "./call-sdk";
import { erc20Approval, TransactionError } from "./transactions";
import { AddLiquidityData, RemoveLiquidityData } from "./types";


async function formatOutputAndExecute<T>(res: MethodReturnType<T>, chainId: number, isDemo: boolean, executeTx: boolean, userAddress: string) {
    if (!executeTx) {
        return {
            status: 'success',
            hash: null,
            quoteData: res.data as T
        };
    }
    if (res.tokenApprovals) {
        const tokenApprovals = res.tokenApprovals.map((tokenApproval) => {
            return erc20Approval(tokenApproval.token, res.tx.to, tokenApproval.amount, userAddress, chainId, isDemo);
        });
    }
    // Send tx
    try {
        // Prepare transaction data with the required 'from' property
        const txData = {
            to: res.tx.to,
            from: userAddress,
            data: res.tx.data,
            value: res.tx.value || '0'
        };
        
        const tx = await executeTransaction(txData, chainId, {estimateGas: true}, isDemo);
        return {
            status: 'success',
            hash: tx.hash,
            quoteData: res.data as T
        };
    } catch (error) {
        if (error instanceof TransactionError) {
            return {
                status: 'fail',
                error: error.message,
                hash: error.hash,
                quoteData: res.data as T
            };
        }
        throw error;
    }
}


/**
 * Add liquidity to a single PT market
 * @param chainId - The chain ID
 * @param marketAddress - The market address
 * @param receiverAddress - The receiver address
 * @param tokenInAddress - The input token address
 * @param amountIn - The amount of input token to add in wei
 * @param slippage - The slippage tolerance, 0.01 = 1%
 * @param isDemo - Whether to use the demo mode
 */
export async function addLiquiditySingleEnableAggregator(chainId: number, marketAddress: string, receiverAddress: string, tokenInAddress: string, amountIn: string, slippage: number, zeroPriceImpact: boolean, isDemo: boolean, executeTx: boolean) {
    // Use 1 PT to add liquidity to wstETH pool with 1% slippage
    let res: MethodReturnType<AddLiquidityData> | null = null
    try {
        res = await callSDK<AddLiquidityData>(`/v1/sdk/${chainId}/markets/${marketAddress}/add-liquidity`, {
        receiver: receiverAddress,
        slippage: slippage,
        tokenIn: tokenInAddress,
        amountIn: amountIn,
        enableAggregator: true,
        zpi: zeroPriceImpact
    });}
    catch (error: any) {

        return {
            status: 'fail',
            error: error.message,
            hash: null,
            quoteData: null
        }
        
    }

    return formatOutputAndExecute(res, chainId, isDemo, executeTx, receiverAddress);

    
}


export async function removeLiquiditySingleEnableAggregator(chainId: number, marketAddress: string, receiverAddress: string, tokenOutAddress: string, amountIn: string, slippage: number, isDemo: boolean, executeTx: boolean) {
    // Remove 1 LP from wstETH pool to PT with 1% slippage
    let res: MethodReturnType<RemoveLiquidityData> | null = null
    try {
    res = await callSDK<RemoveLiquidityData>(`/v1/sdk/${chainId}/markets/${marketAddress}/remove-liquidity`, {
        receiver: receiverAddress,
        slippage: slippage,
        tokenOut: tokenOutAddress,
        amountIn: amountIn,
        enableAggregator: true
    });

   }
    catch (error: any) {
        return {
            status: 'fail',
            error: error.message,
            hash: null,
            quoteData: null
        }
    }

    return formatOutputAndExecute(res, chainId, isDemo, executeTx, receiverAddress);
}
import { callSDK } from "./call-sdk";
import { AddLiquidityData } from "./types";
import { MethodReturnType } from "./call-sdk";
import { executeSwapTransaction, erc20Approval } from "./transactions";
import { TransactionError } from "./transactions";


async function formatOutputAndExecute(res: MethodReturnType<AddLiquidityData>, chainId: number, isDemo: boolean, executeTx: boolean, userAddress: string) {
    if (!executeTx) {
        return {
            status: 'success',
            hash: null,
            addLiquidityData: res.data as AddLiquidityData
        };
    }
    if (res.tokenApprovals) {
        const tokenApprovals = res.tokenApprovals.map((tokenApproval) => {
            return erc20Approval(tokenApproval.token, res.tx.to, tokenApproval.amount, userAddress, chainId, isDemo);
        });
        // console.log("tokenApprovals", tokenApprovals)
        const txs = await Promise.all(tokenApprovals);
        console.log("txs", txs)
    }
    // Send tx
    try {
        const tx = await executeSwapTransaction(res.tx, chainId, {estimateGas: true}, isDemo);
        return {
            status: 'success',
            hash: tx.hash,
            addLiquidityData: res.data as AddLiquidityData
        };
    } catch (error) {
        if (error instanceof TransactionError) {
            return {
                status: 'failed',
                error: error.message,
                hash: error.hash,
                addLiquidityData: res.data as AddLiquidityData
            };
        }
        throw error;
    }
}

/**
 * Add liquidity to a single PT market
 * @param chainId - The chain ID
 * @param marketAddress - The market address
 * @param userAddress - The user address to receive the result tokens
 * @param ptAddress - The PT address
 * @param amountIn - The amount of PT to add
 * @param slippage - The slippage tolerance, 0.01 = 1%
 * @param isDemo - Whether to use the demo mode
 */
export async function addLiquiditySinglePt(chainId: number, marketAddress: string, userAddress: string, ptAddress: string, amountIn: string, slippage: number, isDemo: boolean, executeTx: boolean) {
    // Use 1 PT to add liquidity to wstETH pool with 1% slippage
    const res = await callSDK<AddLiquidityData>(`/v1/sdk/${chainId}/markets/${marketAddress}/add-liquidity`, {
        receiver: userAddress,
        slippage: slippage,
        tokenIn: ptAddress,
        amountIn: amountIn
    });

    console.log('Amount LP Out: ', res.data.amountLpOut);
    console.log('Price impact: ', res.data.priceImpact);
    return formatOutputAndExecute(res, chainId, isDemo, executeTx, userAddress);

    
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
            status: 'failed',
            error: error.message,
            hash: null,
            addLiquidityData: null
        }
        
    }

    console.log('Amount LP Out: ', res.data.amountLpOut);
    console.log('Price impact: ', res.data.priceImpact);
    return formatOutputAndExecute(res, chainId, isDemo, executeTx, receiverAddress);

    
}


export async function addLiquiditySingleSy(chainId: number, marketAddress: string, receiverAddress: string, syAddress: string, amountIn: string, slippage: number, isDemo: boolean, executeTx: boolean) {
    // Use 1 SY to add liquidity to wstETH pool with 1% slippage
    const res = await callSDK<AddLiquidityData>(`/v1/sdk/${chainId}/markets/${marketAddress}/add-liquidity`, {
        receiver: receiverAddress,
        slippage: slippage,
        tokenIn: syAddress,
        amountIn: amountIn,
    });

    console.log('Amount LP Out: ', res.data.amountLpOut);
    console.log('Price impact: ', res.data.priceImpact);
    return formatOutputAndExecute(res, chainId, isDemo, executeTx, receiverAddress);
}

export async function addLiquiditySingleSyKeepYt(chainId: number, marketAddress: string, receiverAddress: string, syAddress: string, amountIn: string, slippage: number, isDemo: boolean, executeTx: boolean) {
    // Use 1 SY to add liquidity to wstETH pool (zero price impact mode) with 1% slippage
    const res = await callSDK<AddLiquidityData>(`/v1/sdk/${chainId}/markets/${marketAddress}/add-liquidity`, {
        receiver: receiverAddress,
        slippage: slippage,
        tokenIn: syAddress,
        amountIn: amountIn,
        zpi: true,
    });

    console.log('Amount LP Out: ', res.data.amountLpOut);
    console.log('Amount YT Out: ', res.data.amountYtOut);
    console.log('Price impact: ', res.data.priceImpact);
    return formatOutputAndExecute(res, chainId, isDemo, executeTx, receiverAddress);
}

export async function addLiquiditySingleToken(chainId: number, marketAddress: string, receiverAddress: string, tokenAddress: string, amountIn: string, slippage: number, isDemo: boolean, executeTx: boolean) {
    // Use 1 wstETH to add liquidity to wstETH pool with 1% slippage
    const res = await callSDK<AddLiquidityData>(`/v1/sdk/${chainId}/markets/${marketAddress}/add-liquidity`, {
        receiver: receiverAddress,
        slippage: slippage,
        tokenIn: tokenAddress,
        amountIn: amountIn,
    });

    console.log('Amount LP Out: ', res.data.amountLpOut);
    console.log('Price impact: ', res.data.priceImpact);
    return formatOutputAndExecute(res, chainId, isDemo, executeTx, receiverAddress);
}

export async function addLiquiditySingleTokenKeepYt(chainId: number, marketAddress: string, receiverAddress: string, tokenAddress: string, amountIn: string, slippage: number, isDemo: boolean, executeTx: boolean) {
    // Use 1 wstETH to add liquidity to wstETH pool (zero price impact mode) with 1% slippage
    const res = await callSDK<AddLiquidityData>(`/v1/sdk/${chainId}/markets/${marketAddress}/add-liquidity`, {
        receiver: receiverAddress,
        slippage: slippage,
        tokenIn: tokenAddress,
        amountIn: amountIn,
        zpi: true,
    });

    console.log('Amount LP Out: ', res.data.amountLpOut);
    console.log('Amount YT Out: ', res.data.amountYtOut);
    console.log('Price impact: ', res.data.priceImpact);
    return formatOutputAndExecute(res, chainId, isDemo, executeTx, receiverAddress);
}
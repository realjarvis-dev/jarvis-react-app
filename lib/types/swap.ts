/** 
 * @param chainId Chain ID
 * @param tokenIn Address of the input token
 * @param tokenOut Address of the output token
 * @param fromAddress Address of the sender
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 */
export type EnsoSwapInput = {
    chainId: number,
    tokenIn: string
    tokenOut: string,
    fromAddress: string,
    amountIn: string,
    slippage: number,
    destinationChainId?: number
}

/** 
 * @param tokenOut Address of the output token
 * @param fromAddress Address of the sender
 * @param amountIn Amount of input token in wei
 * @param slippage Slippage tolerance (e.g., 0.01 for 1%)
 */
export type EnsoSwapETHToPTInput = {
    tokenOut: string,
    fromAddress: string,
    amountIn: string,
    slippage: number
}

export type EnsoSwapOutput = {
    amountOut: string[]
    gas: string
    tx: {
        to: string
        data: string
        value: string
        gas: string
    }
    route: {
        protocol: string
        action: string
        tokenIn: string
        tokenOut: string
        amountIn: string
        amountOut: string
        gas: string
    }[]
    priceImpact?: string
    feeAmount?: string
}

/**
 * @param data Transaction data
 * @param to Address of the recipient
 * @param from Address of the sender
 * @param value Value of the transaction in wei
 */
export type EnsoTxInput = {
    data: string,
    to: string,
    from: string,
    value: string
}
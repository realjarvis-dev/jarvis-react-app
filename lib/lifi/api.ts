import { LifiQuoteResponse } from "../types/lifi";
  
  /**
   * Get a quote for a cross-chain swap.
   * @param fromChainId - The ID of the chain to swap from.
   * @param toChainId - The ID of the chain to swap to.
   * @param fromToken - The symbol of the token to swap from.
   * @param toToken - The symbol of the token to swap to.
   * @param fromAmount - The amount of the token to swap from.
   * @param fromAddress - The address of the user's wallet.
   * @param toAddress - The address of the user's wallet.
   * @param slippage - The slippage tolerance for the transaction, 0.005 represents 0.5% slippage.
   * @returns A quote for the cross-chain swap.
   */
  // @Cacheable({ ttlSeconds: 300 })
export async function getLifiQuote(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    fromAddress: string,
    toAddress: string,
    slippage: string
  ): Promise<LifiQuoteResponse> {
    const baseUrl = 'https://li.quest/v1/quote'
    const params = new URLSearchParams({
      fromChain: fromChainId.toString(),
      toChain: toChainId.toString(),
      fromToken: fromToken,
      toToken: toToken,
      fromAmount: fromAmount,
      fromAddress: fromAddress,
      toAddress: toAddress,
      slippage: slippage
    })

    const response = await fetch(`${baseUrl}?${params.toString()}`)

    if (!response.ok) {

      const errorBody = JSON.stringify(await response.json())
      throw new Error(
        `LI.FI API request failed with status ${response.status}: ${errorBody}`
      )
    }

    const result: LifiQuoteResponse = await response.json()
    return result
  }
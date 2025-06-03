import { TransactionRequest } from "ethers"
export interface Token {
  address: string
  symbol: string
  decimals: number
  chainId: number
  name: string
  logoURI?: string
  priceUSD?: string
  // Other token properties can be added here as needed
}

export interface Estimate {
  fromAmount: string
  toAmount: string
  toAmountMin: string
  fromAmountUSD?: string
  toAmountUSD?: string
  feeCosts?: Array<{
    name: string
    description?: string
    percentage: string
    token: Token
    amount: string
    amountUSD: string
    included?: boolean
  }>
  gasCosts?: Array<{
    type: string
    price?: string
    estimate?: string
    limit?: string
    amount: string
    amountUSD: string
    token: Token
  }>
  // Other estimate properties can be added here
}

// export interface TransactionRequest {
//   data: string
//   to: string
//   value: string // Hex string
//   from?: string // Optional, as it might be injected by the wallet
//   chainId: number
//   gasPrice?: string // Hex string
//   gasLimit?: string // Hex string
//   // Other transaction properties
// }

// The main response object from the /quote endpoint
export interface LifiQuoteResponse {
  id: string
  type: string // e.g., "lifi", "swap"
  tool: string // e.g., "hop", "uniswap"
  action: {
    fromChainId: number
    fromToken: Token
    fromAmount: string
    toChainId: number
    toToken: Token
    slippage: number // The actual slippage used or configured
    fromAddress?: string
    toAddress?: string
  }
  estimate: Estimate
  transactionRequest: TransactionRequest // This can be optional based on the flow
  // Other potential fields for a Step object
  integrator?: string
  execution?: {
    status: string
    // ... other execution details
  } | null
  // Potentially includedSteps for more complex routes
}

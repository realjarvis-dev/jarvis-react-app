// Common interface for token price data across different providers
export interface TokenPrice {
  address: string
  price: number
}

// Generic response type for price APIs
export interface PriceApiResponse<T extends TokenPrice> {
  data: T[]
}

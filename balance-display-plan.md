# Performance-Optimized USD Balance Display Plan

## 1. Overview

Display the total USD value of a user's token balances next to the `ChainSelector` component. This will use `react-query` for efficient data fetching, caching, and state management. Balances will update automatically when the selected chain changes.

## 2. New Components & Hooks

- **`components/ui/balance-display.tsx`**: A new presentational component that takes the USD balance as a prop and displays it. It will handle formatting (e.g., `$1,234.56`) and a loading/skeleton state.
- **`hooks/use-wallet-balance.ts`**: A custom hook responsible for fetching and calculating the wallet's total USD balance.
  - It will use `useQuery` from `react-query`.
  - The query key will be `['walletBalance', walletAddress, chainId, isDemoMode]`. This ensures `react-query` automatically re-fetches when the wallet address or chain changes.
  - The query function will:
    1.  Call `getTokenBalances(walletAddress, chainId, isDemoMode)` to get all tokens and their balances.
    2.  For each token, call a pricing function `getUsdPrice(tokenAddress, chainId)` to get its value in USD. We will initially mock this function.
    3.  Calculate the total value: `sum(token.balance * token.usdPrice)`.
    4.  Return the total USD balance, loading status, and any errors.

## 3. Price Fetching

- **`lib/pricing/index.ts`** (or similar): This file will contain the function to get token prices.
- `getUsdPrice(tokenAddress: string, chainId: number): Promise<number>`: A function that fetches the USD price for a given token from a service like Enso. For initial implementation, this can return a mock price.
- To optimize, we should implement a `getUsdPrices(tokenAddresses: string[], chainId: number): Promise<Record<string, number>>` to fetch prices for multiple tokens in a single batch request if the API supports it.

## 4. UI Integration

- The component that currently uses `ChainSelector` (e.g., a header component) will be modified.
- It will use the `useWalletBalance` hook to get the balance.
- It will render the `BalanceDisplay` component next to the `ChainSelector`, passing the balance and loading state as props. They should be grouped within a flex container for proper alignment.

## 5. Triggering Re-fetches (Real-time with Server-Sent Events and Redis Pub/Sub)

To provide real-time balance updates after a backend action (like a swap), we will use Server-Sent Events (SSE) powered by Redis Pub/Sub, as outlined in the [Upstash real-time notifications guide](https://upstash.com/blog/realtime-notifications). This approach replaces the polling mechanism with a persistent, push-based connection.

### A. Redis Pub/Sub Configuration

- **Channel Structure:** We will use a user-specific Pub/Sub channel for notifications. The channel name will be `balance-updates:[USER_ID]`.
- **Message:** The message published to the channel will be a simple JSON object, e.g., `{ "status": "updated", "timestamp": 1678886400000 }`.

### B. Backend `tool` Modification (`executeLifiBridgeTransaction`)

- After a swap transaction is successfully confirmed, the function will publish a notification to the user's Redis channel.
- It will use the `@upstash/redis` client for publishing.
- **Example:** `await redis.publish('balance-updates:USER_ID', JSON.stringify({ status: 'updated', timestamp: Date.now() }))`

### C. New API Endpoint: `/api/balance-stream` (Server-Sent Events)

- A new Next.js API route will be created to handle SSE connections.
- **Function:** It establishes a long-lived connection with the client, subscribing to Redis and forwarding messages.
- **Logic:**
  1.  Get the user's ID from the session.
  2.  Set the response headers for an SSE stream: `Content-Type: text/event-stream; charset=utf-8`, `Connection: keep-alive`, `Cache-Control: no-cache, no-transform`.
  3.  Create a `ReadableStream` to push data to the client.
  4.  Inside the stream, use a Redis client that supports the `subscribe` command (e.g., `ioredis`) to listen to the `balance-updates:[USER_ID]` channel.
  5.  On receiving a message from Redis, `enqueue` it into the stream, formatted as an SSE message: `data: ${JSON.stringify(message)}\n\n`.
  6.  The connection must handle cleanup and potential terminations gracefully.

### D. Frontend Hook Modification (`hooks/use-wallet-balance.ts`)

The `useWalletBalance` hook will be updated to listen for SSE notifications and trigger re-fetches without polling.

1.  **Main Balance Fetching Query:**

    - The `useQuery` for fetching the balance remains, but its key is simplified.
    - `queryKey`: `['walletBalance', walletAddress, chainId, isDemoMode]`.
    - This query will be re-fetched on demand, not based on a changing key.

2.  **SSE Connection Management:**
    - A `useEffect` hook will be added to manage the SSE connection.
    - It will get the `queryClient` from `useQueryClient()`.
    - **Connect:** It creates an `EventSource` instance pointing to the `/api/balance-stream` endpoint.
    - **Listen:** It adds a `message` event listener. When a message is received, it invalidates the balance query to trigger a re-fetch: `queryClient.invalidateQueries({ queryKey: ['walletBalance', walletAddress] })`.
    - **Cleanup:** The `useEffect` return function will close the `EventSource` connection (`eventSource.close()`) when the component unmounts.
    - **Persistence:** To ensure a stable connection, implement an auto-reconnect mechanism. If the `EventSource` encounters an `error` or is closed (`onclose`), it should attempt to reconnect after a short delay.

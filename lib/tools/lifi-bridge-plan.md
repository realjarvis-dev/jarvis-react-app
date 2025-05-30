# Plan for Refactoring lifi-bridge.ts and Adding Native Balance Aware Bridging

## I. Refactoring `lib/tools/lifi-bridge.ts`

The primary goal is to move business logic out of the AI tool definitions and into dedicated modules within the `lib/lifi/` directory, improving modularity, testability, and reusability.

### 1. Create New Modules in `lib/lifi/`

- **`lib/lifi/actions.ts`**: Will contain core functions for fetching quotes and preparing/executing transactions.
- **`lib/lifi/utils.ts`**: Will house helper functions, such as clarification message generators, amount parsers, and potentially balance checkers.
- **`lib/lifi/types.ts`** (if not already existing or needs expansion): For any custom types related to these operations, beyond what `../types/lifi` provides.

### 2. Relocate Logic from `bridgeQuoteTool.execute`

- **Move to `lib/lifi/actions.ts` (e.g., `generateLifiBridgeQuote` function):**
  - Fetching user EVM address (`getUserEvmWalletAddress`).
  - Fuzzy intent detection (`lifiService.fuzzyIntentDetect`).
  - Token clarification logic (this might call helpers in `utils.ts`).
  - Input amount parsing (`ethers.parseUnits`).
  - Wrapping the `getLifiQuote` API call from `lib/lifi/api.ts`.
  - Comprehensive error handling for the quoting process.
  - Formatting the `LifiQuoteResponse` into the `readableQuote` structure.
- **Move to `lib/lifi/utils.ts`:**
  - `getClarifyInputAndOutputDetail`
  - `getClarifyInputDetail`
  - `getClarifyOutputDetail`

### 3. Relocate Logic from `bridgeExecuteTool.execute`

- **Move to `lib/lifi/actions.ts` (e.g., `executeLifiBridgeTransaction` function):**
  - Fetching user EVM address.
  - Input amount parsing.
  - Calling `getLifiQuote` again to get the final `transactionRequest` (Investigate if the initial quote can be used or if Li.Fi offers a way to get execution data from a quote ID).
  - `erc20Approval` logic (this itself might be a candidate for `lib/lifi/utils.ts` or remain in `../pendle/transactions` if generic enough, just called from `actions.ts`).
  - `executeSwapTransaction` logic (similar to `erc20Approval`, assess its current location and how it's called).
  - Formatting success and error responses.

### 4. Update `lib/tools/lifi-bridge.ts`

- Modify `bridgeQuoteTool.execute` to call the new `generateLifiBridgeQuote` function from `lib/lifi/actions.ts`. It will mostly handle parameter mapping and returning the result in the tool's expected format.
- Modify `bridgeExecuteTool.execute` to call the new `executeLifiBridgeTransaction` function from `lib/lifi/actions.ts`. It will also handle parameter mapping.
- Ensure all necessary imports are updated.

### 5. Refactor Duplicates

- **`getLifiQuote` call:** Consolidate how quotes are fetched. If the `bridgeExecuteTool` _must_ re-fetch a quote, ensure the parameters are derived consistently. Ideally, pass necessary data from the `bridgeQuoteTool`'s result (like the quote object itself or specific fields) to `bridgeExecuteTool` if the user confirms.
- **User Address Fetching:** Centralize `getUserEvmWalletAddress` if it's called in multiple places within the new `actions.ts` functions.
- **Amount Parsing:** Use a shared utility in `lib/lifi/utils.ts` if `ethers.parseUnits` is used with the same logic in multiple places.

## II. New Feature: Native Balance Aware Two-Step Bridging

This feature addresses scenarios where the user has insufficient native currency on the destination chain to pay for gas for subsequent transactions (like the final swap to the desired non-native token).

### 1. Add Native Balance Checking

- **Create in `lib/lifi/utils.ts` (or a new `lib/evm/rpc.ts`):**
  - `getNativeBalance(chainId: number, address: string): Promise<bigint>`: Uses `ethers.js` provider to fetch the native balance.
- **Define Threshold:**
  - Establish a constant for the minimum desired native token balance to leave on the destination chain (e.g., `DESTINATION_NATIVE_MIN_BALANCE_WEI`). This should be configurable. Consider its USD equivalent.

### 2. Modify Quoting Logic (within the new `generateLifiBridgeQuote` in `lib/lifi/actions.ts`)

1.  **After** `fromChainMatch`, `toChainMatch`, `fromTokenSingle`, `toTokenSingle` are determined:
2.  **Check if `toTokenSingle` is native:**
    - Compare `toTokenSingle.address` to the zero address or check `toTokenSingle.symbol` against `toChainMatch.nativeCurrency.symbol`.
3.  **If `toTokenSingle` is NOT native:**
    - Call `getNativeBalance(toChainMatch.id, recipient)` to get the user's current native balance on the destination chain.
    - **If `balance < DESTINATION_NATIVE_MIN_BALANCE_WEI`:**
      - **Initiate Two-Step Quoting Process:**
        1.  **Determine Native Token for `toChainMatch`:** Get its symbol, address, decimals from `toChainMatch.nativeCurrency` or `chainsById[toChainMatch.id].nativeCurrency`.
        2.  **Calculate Amount for Step 1 (Bridge to Native):** This is complex. The amount bridged to native on the destination chain must cover:
            - The value of the target `toTokenSingle` amount.
            - The desired `DESTINATION_NATIVE_MIN_BALANCE_WEI` to be left over.
            - Gas fees for the _second_ transaction (native-to-`toTokenSingle` swap on the destination chain). This might require a pre-estimation or using a Li.Fi API feature if it supports estimating swaps. For a simpler start, it could be a fixed buffer or a percentage.
        3.  **Get Quote for Step 1:** Call `getLifiQuote` for:
            - `fromChainMatch.id`, `toChainMatch.id`
            - `fromTokenSingle.symbol`, `NATIVE_TOKEN_DEST.symbol`
            - `calculatedAmountInForStep1`, `userEvmAddress`, `recipient`, `slippage`
        4.  **If Step 1 quote is successful:**
            - The `readableQuote` returned to the user needs to be significantly different. It must clearly state:
              - This is a two-step process.
              - **Step 1:** Bridge `X fromToken` to `Y NATIVE_TOKEN_DEST` on `toChainMatch.name`. Show estimated output, fees.
              - **Step 2 (Planned):** Swap `Y - threshold NATIVE_TOKEN_DEST` to `Z toTokenSingle` on `toChainMatch.name`. Estimate this swap's outcome if possible (e.g. using another `getLifiQuote` for a single-chain swap on the destination, or clearly state it's an estimate).
              - Mention that `threshold NATIVE_TOKEN_DEST` will remain on the destination chain.
              - The `instruction` should guide the AI/user that confirming will execute Step 1, and then a _separate_ execution will be needed for Step 2.
            - Store necessary details from the Step 1 quote to facilitate Step 2 execution later (e.g., the amount of native token expected on the destination chain).
      - **Else (sufficient native balance):** Proceed with the original single-step quote logic.
4.  **Else (`toTokenSingle` IS native):** Proceed with the original single-step quote logic.

### 3. Modify Execution Logic (`bridgeExecuteTool` and `executeLifiBridgeTransaction`)

- The `bridgeExecuteTool`'s parameters might need to accept an indicator if it's executing "Step 1" of a two-step plan, or if the quote object passed implicitly contains this info.
- When `executeLifiBridgeTransaction` is called for Step 1 (bridge to native):
  - Its success response should clearly indicate that Step 1 is complete and provide details for initiating Step 2.
  - For example: "Successfully bridged [amount] [fromToken] to [amount] [NativeDestToken] on [DestChain]. Now, you need to swap [NativeDestToken] to [toToken] on [DestChain]. Use `lifi_bridge_execute` (or a new dedicated swap tool) with parameters: fromChainId=[DestChainId], fromToken=[NativeDestTokenSymbol], toToken=[toTokenSymbol], amountIn=[Amount of NativeDestToken to swap, leaving threshold behind]..."
- **A new tool or an extension to `bridgeExecuteTool` will be required for Step 2 (on-chain swap from native to target token on the destination chain).**
  - This tool would take parameters like: `chainId`, `fromTokenSymbol` (native), `toTokenSymbol` (target), `amountInNativeHumanReadable`.
  - It would use `getLifiQuote` for a single-chain swap on the destination chain to get the transaction data, then call `erc20Approval` (if `toToken` is native, this won't be needed, but Li.Fi handles native vs ERC20 swaps) and `executeSwapTransaction`.

### 4. Data to Pass Between Quote and Execute

- The `readableQuote` (or a more structured object returned by `generateLifiBridgeQuote`) should contain all necessary information for `bridgeExecuteTool` to perform its job without re-deriving everything, especially for the two-step process.
- This includes: `fromChainId`, `toChainId`, resolved `fromToken` (symbol, address, decimals), resolved `toToken` (symbol, address, decimals), `isFromNativeToken`, `amountIn` (raw, for `parseUnits`), and flags/details indicating if it's a two-step transaction and what the target for each step is.

### 5. Error Handling

- Robust error handling for balance checks, and each step of the two-step quote and execution process.
- Clear messages if any part fails (e.g., "Failed to get quote for bridging to native token," "User has native funds, but not enough to also cover the swap to the final token plus threshold.").

This plan aims to make the Li.Fi bridge integration more robust, maintainable, and user-friendly, especially for users new to a particular chain.

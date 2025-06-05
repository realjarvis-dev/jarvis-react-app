### Revised Plan for Refactoring Network Configuration and Token Balance Retrieval

The current setup for managing network configurations and fetching token balances requires modifications in multiple files when adding support for a new network. This refactoring aims to centralize network configurations using the existing `lib/network/config.ts` and `lib/network/types.ts`, and streamline the process of fetching balances.

**1. Enhance Existing Network Configuration (`lib/network/types.ts` and `lib/network/config.ts`):**

- **Augment `NetworkConfig` Interface (in `lib/network/types.ts`):**

  - Add a new required property `nativeAsset` to the `NetworkConfig` interface:

    ```typescript
    export interface NativeAsset {
      name: string
      symbol: string
      decimals: number
    }

    export interface NetworkConfig {
      // ... existing properties ...
      readonly nativeAsset: NativeAsset // Add this
    }
    ```

- **Populate `nativeAsset` in `lib/network/config.ts`:**
  - For each existing network configuration object (e.g., `ethereumConfig`, `berachainConfig`, `baseConfig`, etc.), add the `nativeAsset` property with its corresponding details (name, symbol, decimals).
    - Example for `ethereumConfig`:
      ```typescript
      nativeAsset: { name: "Ether", symbol: "ETH", decimals: 18 },
      ```
    - This data will be migrated from the current `lib/alchemy/native-asset-mapping.ts`.
  - Ensure `TENDERLY_DEMO_CONFIG` in `lib/network/config.ts` also has the `nativeAsset` property defined (e.g., for Ethereum).
  - The existing utility functions like `getActiveNetworkConfig(isDemoMode, selectedChain)` and `getConfigByChainId(chainId, isDemo)` in `lib/network/config.ts` will be crucial.

**2. Refactor `lib/alchemy/client.ts`:**

- Import `allNetworkConfigs`, `TENDERLY_DEMO_CONFIG`, and `getConfigByChainId` from `lib/network/config.ts`.
- **Dynamically Create Alchemy Clients:**
  - Remove individually exported client instances (e.g., `mainnetAlchemy`, `sepoliaAlchemy`, etc.).
  - The `chainIdToAlchemyClient: Record<number, Alchemy>` map will be populated by iterating through `Object.values(allNetworkConfigs)`.
  - For each `NetworkConfig` that has an `alchemyNetwork` property, an Alchemy client will be instantiated using `makeAlchemyClient` and added to `chainIdToAlchemyClient` using its `chainId` as the key.
  - The `makeAlchemyClient` helper function will be retained.
- **Demo Client (`demoAlchemy`):**
  - The `demoAlchemy` client should be instantiated using the details from `TENDERLY_DEMO_CONFIG`. If `TENDERLY_DEMO_CONFIG` has an `alchemyNetwork` specified, `makeAlchemyClient` can be used. The existing logic for `connectionInfoOverrides` using `TENDERLY_DEMO_CONFIG.rpcUrl` should be reviewed and maintained if it's for a non-standard Alchemy setup or direct RPC proxy.
- **Refine `getAlchemyClient(chainId: number, isDemo: boolean = false)`:**
  - If `isDemo` is true and the `chainId` matches `TENDERLY_DEMO_CONFIG.chainId`, return `demoAlchemy`.
  - Otherwise, retrieve the client from the dynamically populated `chainIdToAlchemyClient` map using the provided `chainId`. If not found, throw an error or return a default/undefined as appropriate.

**3. Deprecate `lib/alchemy/native-asset-mapping.ts`:**

- All native asset information will now reside within the `nativeAsset` property of each `NetworkConfig` object in `lib/network/config.ts`.
- Delete the file `lib/alchemy/native-asset-mapping.ts`.
- Update all import statements and usages across the codebase that previously referenced `nativeAssets` from the old file to now use `getConfigByChainId(chainId, isDemo).nativeAsset`.

**4. Refactor `lib/alchemy/get-token-balance.ts`:**

- **Remove Specific Balance Functions:**
  - Delete `getMainnetTokenBalance`, `getSepoliaTokenBalance`, `getBerachainMainnetTokenBalance`, `getBerachainBepoliaTokenBalance`.
- **Consolidate into a single `getTokenBalance` function (or rename `getTokenBalanceByChainId` to be the main function):**
  - The primary function for fetching token balances should be `getTokenBalance(walletAddress: string, chainId: number, isDemo: boolean = false): Promise<TokenData[]>`.
  - This function will:
    1.  Retrieve the `NetworkConfig` using `getConfigByChainId(chainId, isDemo)` from `lib/network/config.ts`.
    2.  Determine the method for fetching balances:
        - **For Tenderly Demo Network** (i.e., if `isDemo` is true and `chainId` matches `TENDERLY_DEMO_CONFIG.chainId`):
          - Use the existing logic from `getTenderlyDemoTokenBalance` which involves direct `ethers.JsonRpcProvider` calls with `TENDERLY_DEMO_CONFIG.rpcUrl` for both ERC20 tokens (iterating `commonlyUsedPTTokensArray`, `commonlyUsedTokensArray`) and the native balance. The `nativeAsset` details will come from the `NetworkConfig`.
        - **For Standard Alchemy Networks:**
          - Get the `Alchemy` client instance using `getAlchemyClient(chainId, false)` (isDemo should be false here as we've separated the demo logic path).
          - Fetch ERC20 balances using `alchemy.core.getTokenBalances()` and metadata using `alchemy.core.getTokenMetadata()`.
          - Fetch native balance using `alchemy.core.getBalance()`.
          - The `nativeAsset` details for formatting the native token (`name`, `symbol`, `decimals`) will come from the `NetworkConfig`.
- **Update `TokenData` formatting:**
  - The `network` field in `TokenData` should be populated using `networkConfig.displayName` or a similar relevant field from the `NetworkConfig`.
- **Refactor `getNativeBalanceByChainId(walletAddress: string, chainId: number, isDemo: boolean = false): Promise<bigint>`:**
  - Retrieve the `NetworkConfig` using `getConfigByChainId(chainId, isDemo)`.
  - If it's the Tenderly demo network (based on `isDemo` and `chainId`), use `ethers.JsonRpcProvider(networkConfig.rpcUrl).getBalance()` and return as `bigint`.
  - Otherwise, use `getAlchemyClient(chainId, false).core.getBalance(walletAddress, 'latest').then(balance => balance.toBigInt())`.
- The `tokenBalanceFunctions` array (if still needed for some purpose) should be updated to reflect the new unified approach, likely just containing the main refactored balance function.

**Benefits:**

- **True Single Source of Truth**: `lib/network/config.ts` (with types from `lib/network/types.ts`) becomes the definitive place for all network-related information, including native assets.
- **Reduced Boilerplate**: Eliminates redundant client instantiations in `client.ts` and per-network balance functions in `get-token-balance.ts`.
- **Improved Maintainability**: Adding or updating a network primarily involves changes in `lib/network/config.ts`.
- **Enhanced Clarity**: A single, robust function for fetching token balances, adaptable to different network types (Alchemy-supported vs. custom RPC like Tenderly).

This revised plan leverages the existing configuration structure and focuses on centralizing data and streamlining logic.

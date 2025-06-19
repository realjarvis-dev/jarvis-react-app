# Implement Unified Token Registry with Static Cache Files + Fix SENA Token Resolution

## Overview
This PR implements a centralized, performant token resolution system that eliminates fragmented token lookup approaches across Pendle tokens, wallet tokens, and common tokens in the Jarvis investment agent. Additionally, it fixes the critical SENA PT token matching issue by adding token name resolution capabilities to the pendleQuoteTool.

## Key Changes

### 1. Static Pendle Token Registry
- **Created** `lib/token-matcher/config/pendle/tokens.ts` with 453 tokens across 7 chains
- **Generated** from provided JSON files using automated transformation script
- **Structured** with PT (Principal Token), YT (Yield Token), and SY tokens
- **Includes** market addresses, expiry dates, and underlying asset information

### 2. Extended TokenMatcher System
- **Modified** `lib/token-matcher/fuzzy-token-matcher.ts` to support both Li.Fi and Pendle tokens
- **Created** `lib/token-matcher/pendle-token-matcher.ts` singleton for efficient lookups
- **Added** `lib/token-matcher/unified-token-matcher.ts` for consolidated token resolution
- **Maintained** existing fuzzy matching capabilities with Fuse.js

### 3. Updated Pendle Tools
- **Replaced** live API calls with static cache lookups in `lib/tools/pendle.ts`
- **Updated** `lib/tools/pendle-liquidity.ts` and `lib/tools/pendle-remove-liquidity.ts`
- **Maintained** backward compatibility for dynamic market data (liquidity, APY)
- **Improved** performance by eliminating redundant token metadata API calls

### 4. Enhanced Caching System
- **Extended** `lib/streaming/unified-tool-execution.ts` with new TTL configurations:
  - Static token metadata: 24 hours
  - Pendle opportunities: 30 minutes (increased from 5 minutes)
  - Pendle quotes: 30 seconds (unchanged)

### 5. SENA Token Resolution Fix
- **Updated** `pendleQuoteTool` to accept both token addresses and token names
- **Added** fuzzy token matching logic to resolve names like "sENA PT" to addresses
- **Enhanced** token filtering to handle SENA token variations and case sensitivity
- **Updated** AI researcher instructions to reflect token name acceptance capability
- **Fixed** the reported issue where users couldn't get quotes for SENA PT tokens

## Performance Benefits
- ✅ **Eliminated** redundant API calls for token resolution
- ✅ **Enabled** offline token resolution capability
- ✅ **Provided** consistent fuzzy matching across all tools
- ✅ **Reduced** latency for Pendle operations

## Token Coverage
- **Ethereum (1)**: 249 tokens from 83 markets
- **BSC (56)**: 45 tokens from 15 markets  
- **Arbitrum (42161)**: 48 tokens from 16 markets
- **Base (8453)**: 42 tokens from 14 markets
- **Mantle (5000)**: 6 tokens from 2 markets
- **Blast (80094)**: 27 tokens from 9 markets
- **Polygon zkEVM (146)**: 36 tokens from 12 markets

## Testing
- ✅ Linting passes with no errors
- ✅ All imports and exports properly structured
- ✅ Type definitions correctly implemented
- ✅ Backward compatibility maintained
- ✅ **SENA PT token resolution verified working**:
  - Fuzzy matcher correctly finds SENA PT token from query "sENA PT"
  - Resolves to expected address: `0xfc66d247f577bfc87df8a5267c43676c4a088b8b`
  - Token filtering logic properly handles PT/YT type matching
  - Error handling provides clear messages for unresolvable tokens

## Implementation Details
- **Token Naming**: Uses format `PT-{underlying}-{expiry}` and `YT-{underlying}-{expiry}`
- **Chain Support**: All provided chain files processed and integrated
- **Fuzzy Matching**: Consistent behavior across Li.Fi and Pendle tokens
- **Cache Strategy**: Static tokens cached for 24+ hours, dynamic data refreshed appropriately
- **Token Resolution**: Supports both direct addresses and natural language queries
- **Error Handling**: Clear error messages when tokens cannot be resolved
- **Backward Compatibility**: Existing address-based functionality unchanged

---

**Link to Devin run**: https://app.devin.ai/sessions/65adbd624cab4bfbbc0a52b9f5a97069  
**Requested by**: Allen (allen@kirastudio.xyz)

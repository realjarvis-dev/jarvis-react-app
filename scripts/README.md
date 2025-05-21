# Kodiak Island Investment Scripts

This directory contains scripts for testing and executing investments in Kodiak Islands on the Berachain network.

## Prerequisites

1. Node.js and npm/yarn installed
2. TypeScript installed
3. Private key for a wallet with test funds on Bepolia (Berachain Testnet)

## Setup

Before running any scripts, make sure to set your private key as an environment variable:

```bash
export PRIVATE_KEY=your_private_key_here
```

Or for Windows Command Prompt:

```cmd
set PRIVATE_KEY=your_private_key_here
```

## Available Scripts

### 1. Unified Investment Script (`kodiak-invest.ts`) - Recommended

This is the recommended script that provides a unified interface for all investment operations.

```bash
# Show help message
npx ts-node scripts/kodiak-invest.ts help

# Show information about an island
npx ts-node scripts/kodiak-invest.ts info 0x203eFDe0a9be708A5912fA33612BF1062d370f75

# Deposit with both tokens
npx ts-node scripts/kodiak-invest.ts deposit 0x203eFDe0a9be708A5912fA33612BF1062d370f75 0.1 0.1

# Single-sided deposit with WBERA
npx ts-node scripts/kodiak-invest.ts single 0x203eFDe0a9be708A5912fA33612BF1062d370f75 WBERA 0.5

# Wrap native BERA and deposit
npx ts-node scripts/kodiak-invest.ts wrap 0x203eFDe0a9be708A5912fA33612BF1062d370f75 0.2

# Use mainnet instead of testnet
npx ts-node scripts/kodiak-invest.ts info 0x203eFDe0a9be708A5912fA33612BF1062d370f75 --mainnet

# Show verbose output
npx ts-node scripts/kodiak-invest.ts info 0x203eFDe0a9be708A5912fA33612BF1062d370f75 --verbose
```

### 2. Standard Deposit Script (`kodiak-deposit.ts`)

This script handles deposits when you already have tokens for the island pair.

It supports three scenarios:
- You have both tokens in the pair
- You have only one of the tokens in the pair (single-sided deposit)
- You have neither token (displays informational message)

```bash
npx ts-node scripts/kodiak-deposit.ts
```

### 3. Swap and Deposit Script (`kodiak-swap-and-deposit.ts`)

This script is for when you don't have either token in the pair, but have native BERA to deposit.
It first wraps BERA to WBERA and then performs a single-sided deposit into the island.

```bash
# Default deposits 0.1 BERA
npx ts-node scripts/kodiak-swap-and-deposit.ts

# Specify amount (e.g., 0.5 BERA)
npx ts-node scripts/kodiak-swap-and-deposit.ts 0.5
```

## Target Island Information

The scripts target this testnet island by default:

- **Island Address**: 0x203eFDe0a9be708A5912fA33612BF1062d370f75 (WBERA-HONEY)
- **Token Pair**: WBERA and HONEY
- **Fee Tier**: 0.3%
- **Type**: Managed Island (10% manager fee)

## Customizing

To target a different island, modify the `TARGET_ISLAND` constant in the script files or provide the island address as an argument to the unified script.

## Troubleshooting

1. **Insufficient Balance**: Make sure you have enough BERA or tokens for the deposit
2. **Transaction Failures**: Check gas settings or try with a smaller amount
3. **Approval Issues**: The script handles approvals automatically, but if you encounter issues, you can approve tokens manually through a block explorer

## Moving to Mainnet

Once tested successfully on testnet, you can switch to mainnet by:
- Adding the `--mainnet` flag when using the unified script: `npx ts-node scripts/kodiak-invest.ts [command] [options] --mainnet`
- Changing the `network` parameter from 'bepolia' to 'mainnet' in the transaction generation functions for other scripts 
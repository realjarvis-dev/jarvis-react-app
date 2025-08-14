import { ethers } from 'ethers'

export interface TokenTransfer {
  tokenAddress: string
  from: string
  to: string
  amount: string
  decimals?: number
  symbol?: string
  name?: string
}

export interface ParsedTransactionResult {
  newTokensReceived: TokenTransfer[]
  allTransfers: TokenTransfer[]
}

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/**
 * Parse transaction logs to extract token transfers
 * @param logs Transaction receipt logs
 * @param userAddress User's wallet address to filter for received tokens
 * @returns Parsed token transfers
 */
export function parseTokenTransfers(
  logs: any[],
  userAddress: string
): ParsedTransactionResult {
  const allTransfers: TokenTransfer[] = []
  const newTokensReceived: TokenTransfer[] = []

  for (const log of logs) {
    // Check if this is an ERC20 Transfer event
    if (
      log.topics &&
      log.topics.length === 3 &&
      log.topics[0] === TRANSFER_EVENT_SIGNATURE
    ) {
      try {
        // Decode the transfer event
        const from = ethers.getAddress('0x' + log.topics[1].slice(26)) // Remove leading zeros
        const to = ethers.getAddress('0x' + log.topics[2].slice(26))
        const amount = BigInt(log.data).toString()
        const tokenAddress = ethers.getAddress(log.address)

        const transfer: TokenTransfer = {
          tokenAddress,
          from,
          to,
          amount
        }

        allTransfers.push(transfer)

        // Check if this is a token received by the user
        if (to.toLowerCase() === userAddress.toLowerCase()) {
          newTokensReceived.push(transfer)
        }
      } catch (error) {
        console.warn('Failed to parse transfer log:', error)
        // Continue processing other logs
      }
    }
  }

  return {
    newTokensReceived,
    allTransfers
  }
}

/**
 * Get unique token addresses from transfers
 * @param transfers Array of token transfers
 * @returns Array of unique token addresses
 */
export function getUniqueTokenAddresses(transfers: TokenTransfer[]): string[] {
  const addresses = new Set<string>()
  
  for (const transfer of transfers) {
    addresses.add(transfer.tokenAddress.toLowerCase())
  }
  
  return Array.from(addresses)
}

/**
 * Extract new token addresses that the user received from a transaction
 * @param logs Transaction receipt logs
 * @param userAddress User's wallet address
 * @returns Array of unique token addresses received
 */
export function extractReceivedTokens(
  logs: any[],
  userAddress: string
): string[] {
  const { newTokensReceived } = parseTokenTransfers(logs, userAddress)
  return getUniqueTokenAddresses(newTokensReceived)
}
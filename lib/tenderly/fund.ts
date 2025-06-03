/**
 * Tenderly Virtual Network Funding Utilities
 * 
 * These functions use Tenderly's custom JSON-RPC methods to fund wallets
 * on virtual networks (vnets). Requires admin RPC URL access.
 * 
 * Required environment variable:
 * - TENDERLY_ADMIN_RPC_URL: The admin RPC URL for your Tenderly virtual network
 */

// Admin RPC URL for Tenderly vnet - should be different from regular RPC
const TENDERLY_ADMIN_RPC_URL = process.env.TENDERLY_ADMIN_RPC_URL;

// Configuration constants
export const REQUESTED_FUNDING_AMOUNT = 0.1; // ETH - amount to fund wallet with

interface TenderlyRpcResponse {
  jsonrpc: string;
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Validates that the Tenderly admin RPC URL is configured
 * @throws Error if TENDERLY_ADMIN_RPC_URL is not set
 */
function validateAdminRpcUrl(): string {
  if (!TENDERLY_ADMIN_RPC_URL) {
    throw new Error('TENDERLY_ADMIN_RPC_URL environment variable is not set');
  }
  return TENDERLY_ADMIN_RPC_URL;
}

/**
 * Sets the native token balance (ETH) for specified wallet addresses
 * This overwrites the current balance with the specified amount
 * 
 * @param walletAddresses - Array of wallet addresses to fund
 * @param amountInWei - Amount in wei (as hex string, e.g., "0xDE0B6B3A7640000" for 1 ETH)
 * @returns Promise with the RPC response
 */
export async function setBalanceVnet(
  walletAddresses: string[],
  amountInWei: string
): Promise<TenderlyRpcResponse> {
  try {
    const adminRpcUrl = validateAdminRpcUrl();
    const response = await fetch(adminRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tenderly_setBalance",
        params: [
          walletAddresses,
          amountInWei
        ],
        id: Date.now().toString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error setting balance:', error);
    throw error;
  }
}

/**
 * Adds to the existing native token balance (ETH) for specified wallet addresses
 * This adds the specified amount to the current balance
 * 
 * @param walletAddresses - Array of wallet addresses to fund
 * @param amountInWei - Amount in wei to add (as hex string, e.g., "0xDE0B6B3A7640000" for 1 ETH)
 * @returns Promise with the RPC response
 */
export async function addBalanceVnet(
  walletAddresses: string[],
  amountInWei: string
): Promise<TenderlyRpcResponse> {
  try {
    const adminRpcUrl = validateAdminRpcUrl();
    const response = await fetch(adminRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tenderly_addBalance",
        params: [
          walletAddresses,
          amountInWei
        ],
        id: Date.now().toString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding balance:', error);
    throw error;
  }
}

/**
 * Sets the ERC-20 token balance for specified wallet addresses
 * This overwrites the current token balance with the specified amount
 * 
 * @param tokenAddress - The ERC-20 token contract address
 * @param walletAddresses - Array of wallet addresses to fund
 * @param amountInWei - Amount in wei (as hex string, considering token decimals)
 * @returns Promise with the RPC response
 */
export async function setErc20BalanceVnet(
  tokenAddress: string,
  walletAddresses: string[],
  amountInWei: string
): Promise<TenderlyRpcResponse> {
  try {
    const adminRpcUrl = validateAdminRpcUrl();
    const response = await fetch(adminRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tenderly_setErc20Balance",
        params: [
          tokenAddress,
          walletAddresses,
          amountInWei
        ],
        id: Date.now().toString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error setting ERC-20 balance:', error);
    throw error;
  }
}

/**
 * Utility function to convert ETH amount to wei (hex string)
 * 
 * @param ethAmount - Amount in ETH (e.g., "1.5")
 * @returns Hex string representation in wei
 */
export function ethToWei(ethAmount: string): string {
  const weiAmount = BigInt(Math.floor(parseFloat(ethAmount) * 1e18));
  return `0x${weiAmount.toString(16)}`;
}

/**
 * Utility function to convert token amount to wei considering decimals
 * 
 * @param tokenAmount - Amount in token units (e.g., "100.5")
 * @param decimals - Token decimals (e.g., 18 for most tokens, 6 for USDC)
 * @returns Hex string representation in smallest token unit
 */
export function tokenToWei(tokenAmount: string, decimals: number): string {
  const multiplier = BigInt(10 ** decimals);
  const weiAmount = BigInt(Math.floor(parseFloat(tokenAmount) * Number(multiplier)));
  return `0x${weiAmount.toString(16)}`;
}

/**
 * Tool for the agent to fund a user's wallet with 0.1 ETH
 * This function only works in Demo VNet environment
 * 
 * @param walletAddress - The wallet address to fund
 * @param isDemo - Whether the current network is in demo mode
 * @returns Promise with the RPC response or an error
 */
export async function fundUserWallet(
  walletAddress: string,
  isDemo: boolean
): Promise<TenderlyRpcResponse | { error: string }> {
  // Check if we're in Demo VNet
  if (!isDemo) {
    return { 
      error: "Funding is only available in Demo environment" 
    };
  }

  try {
    // Convert requested funding amount to wei in hex format
    const fundAmount = ethToWei(REQUESTED_FUNDING_AMOUNT.toString());
    
    // Call the addBalanceVnet function with the wallet address
    return await addBalanceVnet([walletAddress], fundAmount);
  } catch (error) {
    console.error('Error funding user wallet:', error);
    return {
      error: `Failed to fund wallet: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}   
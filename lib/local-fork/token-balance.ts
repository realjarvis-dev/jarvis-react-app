import { ethers } from 'ethers'
import { TokenData } from '../types/wallet-token'

/**
 * Local fork token balance provider - queries RPC directly for local fork environments
 */

interface LocalForkTokenConfig {
  address: string
  symbol: string
  decimals: number
  name: string
}

// Known tokens in local fork environments (can be expanded)
const KNOWN_LOCAL_FORK_TOKENS: LocalForkTokenConfig[] = [
  {
    address: '0x93cf0b02d0a2b61551d107378aff60ceae40c342',
    symbol: 'yvCurve-sdYFIv2-f',
    decimals: 18,
    name: 'yearn Curve sdYFI v2 Vault'
  }
]

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)'
]

/**
 * Get token balances for local fork environment using direct RPC calls
 */
export async function getLocalForkTokenBalances(
  walletAddress: string,
  chainId: number = 1
): Promise<TokenData[]> {
  // Only work if TEST_RPC_URL is set (local fork environment)
  if (!process.env.TEST_RPC_URL) {
    return []
  }

  const provider = new ethers.JsonRpcProvider(process.env.TEST_RPC_URL)
  const tokens: TokenData[] = []

  console.log(`Fetching local fork token balances for ${walletAddress}`)

  // Check native ETH balance
  try {
    const ethBalance = await provider.getBalance(walletAddress)
    const ethBalanceFormatted = ethers.formatEther(ethBalance)
    
    if (ethBalance > BigInt(0)) {
      tokens.push({
        address: ethers.ZeroAddress,
        name: 'Ether',
        symbol: 'ETH',
        balance: ethBalanceFormatted,
        network: 'Local Fork',
        decimals: 18
      })
    }
  } catch (error) {
    console.warn('Failed to get ETH balance in local fork:', error)
  }

  // Check known local fork tokens
  for (const tokenConfig of KNOWN_LOCAL_FORK_TOKENS) {
    try {
      const tokenContract = new ethers.Contract(tokenConfig.address, ERC20_ABI, provider)
      
      // Check if contract exists
      const code = await provider.getCode(tokenConfig.address)
      if (code === '0x') {
        continue // Contract doesn't exist
      }

      // Get balance
      const balance = await tokenContract.balanceOf(walletAddress)
      
      if (balance > BigInt(0)) {
        const balanceFormatted = ethers.formatUnits(balance, tokenConfig.decimals)
        
        // Try to get current token details (they might have changed)
        let currentSymbol = tokenConfig.symbol
        let currentName = tokenConfig.name
        let currentDecimals = tokenConfig.decimals
        
        try {
          currentSymbol = await tokenContract.symbol()
          currentName = await tokenContract.name()
          currentDecimals = await tokenContract.decimals()
        } catch (e) {
          // Use defaults if calls fail
        }

        tokens.push({
          address: tokenConfig.address,
          name: currentName,
          symbol: currentSymbol,
          balance: balanceFormatted,
          network: 'Local Fork',
          decimals: currentDecimals
        })

        console.log(`Found local fork token: ${currentSymbol} balance: ${balanceFormatted}`)
      }
    } catch (error) {
      console.warn(`Failed to check token ${tokenConfig.symbol}:`, error)
    }
  }

  return tokens
}

/**
 * Add a new token to the known local fork tokens list
 */
export function addKnownLocalForkToken(tokenConfig: LocalForkTokenConfig): void {
  // Check if token already exists
  const exists = KNOWN_LOCAL_FORK_TOKENS.find(
    token => token.address.toLowerCase() === tokenConfig.address.toLowerCase()
  )
  
  if (!exists) {
    KNOWN_LOCAL_FORK_TOKENS.push(tokenConfig)
    console.log(`Added known local fork token: ${tokenConfig.symbol} at ${tokenConfig.address}`)
  }
}

/**
 * Check if we're in a local fork environment
 */
export function isLocalForkEnvironment(): boolean {
  return !!process.env.TEST_RPC_URL
}
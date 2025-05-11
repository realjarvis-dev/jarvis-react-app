import { TokenBalance } from 'alchemy-sdk'
import { alchemy } from './client'

export const getTokenBalance = async (address: string) => {
  try {
    // Get token balances
    const balances = await alchemy.core.getTokenBalances(address)

    // Remove tokens with zero balance
    const nonZeroBalances = balances.tokenBalances.filter(
      (token: TokenBalance) => {
        return (
          token.tokenBalance !==
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        )
      }
    )

    // Process all tokens in parallel using Promise.all
    const tokenDetailsPromises = nonZeroBalances.map(async token => {
      // Get metadata of token
      const metadata = await alchemy.core.getTokenMetadata(
        token.contractAddress
      )

      // Compute token balance in human-readable format
      let formattedBalance = '0'
      if (token.tokenBalance && metadata.decimals) {
        // Convert hex to decimal and adjust for decimals
        const balance = parseInt(token.tokenBalance, 16)
        formattedBalance = (balance / Math.pow(10, metadata.decimals)).toFixed(
          2
        )
      }

      return {
        address: token.contractAddress,
        name: metadata.name || '',
        balance: formattedBalance,
        symbol: metadata.symbol || ''
      }
    })

    // Wait for all promises to resolve
    const tokenDetails = await Promise.all(tokenDetailsPromises)

    // Log results for debugging
    tokenDetails.forEach(token => {
      console.log(
        `${token.address}. ${token.name}: ${token.balance} ${token.symbol}`
      )
    })

    return tokenDetails
  } catch (error) {
    console.error('Error in getTokenBalance:', error)
    // throw error
    return []
  }
}

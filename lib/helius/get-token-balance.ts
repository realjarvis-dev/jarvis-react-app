import { TokenData } from '../types/wallet-token'
import { searchTokens } from '../jupiter/search'
import { LAMPORTS_PER_SOL } from '@solana/web3.js';




export const getSolanaBalance = async (
    walletAddress: string
): Promise<number> => {
    const response = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                jsonrpc: '2.0',
                id: '1',
                method: 'getBalance',
                params: [walletAddress]
            })
        }
    )
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data.result.value / LAMPORTS_PER_SOL
}

export const getTokenBalances = async (
  walletAddress: string
): Promise<TokenData[]> => {
  const solanaBalance = await getSolanaBalance(walletAddress)
  let tokenBalances: TokenData[] = []
  if (solanaBalance > 0) {
    tokenBalances.push({
      name: 'Solana',
      symbol: 'SOL',
      address: 'So11111111111111111111111111111111111111112',
      balance: solanaBalance.toString(),
      network: 'Solana',
      decimals: 9
    })
  }
  try {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            {
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
            },
            {
              encoding: 'jsonParsed'
            }
          ]
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.result?.value) {
      return tokenBalances
    }

    // Process all tokens in parallel with the cached registry
    const tokenList = await Promise.all(
      data.result.value.map(async (token: any) => {
        try {
          const tokenInfo = await searchTokens(token.account.data.parsed.info.mint)
          
          if (!tokenInfo[0]) {
            return null
          }

          return {
            name: tokenInfo[0].name,
            symbol: tokenInfo[0].symbol,
            address: token.account.data.parsed.info.mint,
            balance: token.account.data.parsed.info.tokenAmount.uiAmount,
            network: 'Solana',
            decimals: token.account.data.parsed.info.tokenAmount.decimals
          }
        } catch (error) {
          console.error('Error processing token:', error)
          return null
        }
      })
    )
    // Filter out null results
    tokenBalances.push(...tokenList.filter((token): token is TokenData => token !== null))
    return tokenBalances
  } catch (error) {
    console.error('Error fetching token balances:', error)
    throw error
  }
}

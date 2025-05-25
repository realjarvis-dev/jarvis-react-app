import { tool } from 'ai'
import { ethers } from 'ethers'
import { appendFile } from 'fs'
import { mkdir } from 'fs/promises'
import path, { dirname } from 'path' // Added import for path operations
import { promisify } from 'util'
import { z } from 'zod'
import { ensoSwap } from '../enso/swap' // Import ensoSwap
import { erc20Approval, executeSwapTransaction } from '../pendle/transactions'
import { getUserEvmWalletAddress } from '../privy/client'

const tokenAddressMap: Record<string, string> = {
  ETH: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
  UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  AAVE: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  MKR: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
  COMP: '0xc00e94cb662c3520282e6f5717214004a7f26888'
}

const tokenDecimalMap: Record<string, number> = {
    ETH: 18,
    USDT: 6,
    USDC: 6,
    DAI: 18,
    WETH: 18,
    WBTC: 8,
    LINK: 18,
    UNI: 18,
    AAVE: 18,
    MKR: 18,
    COMP: 18,
  };

const parameters = z.object({
  tokenInSymbol: z
    .string()
    .default('ETH')
    .describe('Symbol of the input token (e.g., "ETH", "USDC"). Currently only ETH is available'),
  tokenOutSymbol: z
    .string()
    .describe(
      `The symbol of the token to receive (e.g., "USDC", "DAI"). Used for display purposes. Available tokens: ${JSON.stringify(
        Object.keys(tokenAddressMap)
      )}`
    ),
  amountInHuman: z
    .string()
    .describe(
      'Amount of input token to swap in human-readable format (e.g., "1", "100.5").'
    ),
  slippage: z
    .number()
    .min(0.001)
    .max(0.1)
    .default(0.01)
    .describe('Maximum acceptable slippage (default: 0.01, which is 1%).'),
  chainId: z
    .number()
    .default(1)
    .describe(
      'The chain ID for the transaction (default: 1 for Ethereum Mainnet).'
    )
})


export const genericSwapTool = tool({
  description:
    `Execute a swap transaction from a source token to a target token using a specified protocol or a general router.
    Use this tool when user request and swap and no protocol is in the context
    `,
  parameters: parameters,
  execute: async ({
    tokenInSymbol,
    tokenOutSymbol,
    amountInHuman,
    slippage = 0.01,
    chainId = 1
  }) => {
    const tokenOutAddress = tokenAddressMap[tokenOutSymbol].toLowerCase()
    const tokenInAddress = tokenAddressMap[tokenInSymbol].toLowerCase()
    const tokenInDecimals = tokenDecimalMap[tokenInSymbol]
    let erc20Input = false
    console.log('Mock tool start')
    const logFilePath = path.join(dirname(__dirname), 'genericSwapToolMock.log')
    let logContent = `Timestamp: ${new Date().toISOString()}`

    logContent += `Token In Symbol: ${tokenInSymbol}\n`
    logContent += `Token In Address: ${tokenInAddress}\n`
    logContent += `Token In Decimals: ${tokenInDecimals}\n`
    logContent += `Token Out Address: ${tokenOutAddress}\n`
    logContent += `Token Out Symbol: ${tokenOutSymbol}\n`
    logContent += `Amount In Human: ${amountInHuman}\n`
    logContent += `Slippage: ${slippage}\n`
    logContent += `Chain ID: ${chainId}\n`

    await logToFile(logFilePath, logContent)

    try {
      const evmWalletAddress = await getUserEvmWalletAddress()
      if (!evmWalletAddress) {
        throw new Error(
          'EVM wallet address not found. Please connect your wallet.'
        )
      }

      let amountInBaseUnits: string
      let actualTokenInAddress: string
      const upperTokenInSymbol = tokenInSymbol.toUpperCase()

      if (upperTokenInSymbol === 'ETH') {
        try {
          amountInBaseUnits = ethers.parseEther(amountInHuman).toString()
          actualTokenInAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' // Zero address for ETH
        } catch (error) {
          throw new Error(
            `Invalid ETH amount: ${amountInHuman}. ${
              error instanceof Error ? error.message : ''
            }`
          )
        }
      } else {
        erc20Input = true
        // ERC20 input
        if (!tokenInAddress || typeof tokenInDecimals !== 'number') {
          throw new Error(
            `For ERC20 token "${tokenInSymbol}", tokenInAddress and tokenInDecimals are required.`
          )
        }
        try {
          actualTokenInAddress = ethers.getAddress(tokenInAddress) // Validate and checksum
          amountInBaseUnits = ethers
            .parseUnits(amountInHuman, tokenInDecimals)
            .toString()
        

        } catch (error) {
          throw new Error(
            `Invalid amount or address for ${tokenInSymbol}: ${amountInHuman}. Address: ${tokenInAddress}. Decimals: ${tokenInDecimals}. ${
              error instanceof Error ? error.message : ''
            }`
          )
        }
      }

      let txData



      // General swap (ETH -> Token or Token -> Token) using ensoSwap
      txData = await ensoSwap({
          chainId: chainId,
          tokenIn: actualTokenInAddress,
          tokenOut: ethers.getAddress(tokenOutAddress.toLowerCase()), // Validate/checksum
          fromAddress: evmWalletAddress,
          amountIn: amountInBaseUnits,
          slippage
      })




      if (!txData) {
        throw new Error('Failed to prepare transaction data.')
      }

      if (erc20Input) {
        const approvalResult = await erc20Approval(tokenInAddress, txData.to,
            amountInBaseUnits, evmWalletAddress, chainId)
        if (approvalResult.status === 'fail') {
          throw new Error(approvalResult.message)
        }
      }

      logContent += `Transaction Data: ${JSON.stringify(txData)}\n`
      await logToFile(logFilePath, logContent)

      // TODO: uncomment this when ready
      const result = await executeSwapTransaction(txData, chainId=chainId)

      const completeTime = new Date().toISOString()

      return {
        success: true,
        transaction_hash: result.hash,
        swap_details: {
          protocol: 'none',
          from_token_symbol: upperTokenInSymbol,
          from_token_address:
            actualTokenInAddress ===
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
              ? 'ETH'
              : actualTokenInAddress,
          to_token_symbol:
            tokenOutSymbol ||
            ethers.getAddress(tokenOutAddress.toLowerCase()).slice(0, 6) +
              '...',
          to_token_address: ethers.getAddress(tokenOutAddress.toLowerCase()),
          amount_in_human: amountInHuman,
          amount_in_base_units: amountInBaseUnits,
          chain_id: chainId,
          complete_time: completeTime
        }
      }
    } catch (error: any) {
        console.log(error)
      return {

        success: false,
        error: error.message || 'Failed to execute generic swap.',
        swap_details: {
          // Provide as much detail as possible even in failure
          protocol: 'none',
          from_token_symbol: tokenInSymbol?.toUpperCase(),
          from_token_address: tokenInAddress,
          to_token_address: tokenOutAddress,
          amount_in_human: amountInHuman,
          chain_id: chainId
        }
      }
    }
  }
})
const appendFileAsync = promisify(appendFile)
async function logToFile(path: string, message: string) {
  const line = `${new Date().toISOString()} - ${message}
`
  try {
    await appendFileAsync(path, line, 'utf8')
  } catch (err) {
    if ((err as any)?.code === 'ENOENT') {
      // 1. Derive the directory path
      const dir = dirname(path)
      // 2. Recursively create it (no-op if already exists)
      await mkdir(dir, { recursive: true })
      // 3. Retry writing the log
      await appendFileAsync(path, line, 'utf8')
    } else {
      console.error('Failed to write log:', err)
    }
  }
}

// function checksumTest() {
//   for (const addr of Object.values(tokenAddressMap)) {
//     console.log(addr.toLowerCase())
//     ethers.getAddress(addr.toLowerCase())
//   }
// }
// checksumTest()

import { tool } from 'ai';
import { ethers } from 'ethers';
import { appendFile } from 'fs';
import { mkdir } from 'fs/promises';
import path, { dirname } from 'path'; // Added import for path operations
import { promisify } from 'util';
import { z } from 'zod';
import { ensoSwap } from '../enso/swap'; // Import ensoSwap
import { parseUsdAmount, getUsdSupportDescription, createUsdConversionInfo, getEffectiveAmount } from '../utils/usd-parser';
import { erc20Approval, executeTransaction } from '../privy/utils';
import { getUserEvmWalletAddress } from '../privy/client';
import { NetworkContext } from '../types/context';

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}

// Import token mappings from common USD parser
import { TOKEN_ADDRESS_MAP as tokenAddressMap, TOKEN_DECIMAL_MAP as tokenDecimalMap } from '../utils/usd-parser';

const parameters = z.object({
  tokenInSymbol: z
    .string()
    .default('ETH')
    .describe(`Symbol of the input token (e.g., "ETH", "USDC"). Available tokens: ${JSON.stringify(
        Object.keys(tokenAddressMap)
      )}. Notify user if the token is not available.`),
  tokenOutSymbol: z
    .string()
    .describe(
      `The symbol of the token to receive (e.g., "USDC", "DAI"). Used for display purposes. Available tokens: ${JSON.stringify(
        Object.keys(tokenAddressMap)
      )}. Notify user if the token is not available.`
    ),
  amountInHuman: z
    .string()
    .describe(
      getUsdSupportDescription('Amount of input token to swap in human-readable format (e.g., "1", "100.5") in the unit of Input Token. Notify user if output amount is supplied.')
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
    `Execute a swap transaction to exchange one token for another token (e.g., ETH for USDC, ETH for DAI). 
    Use this tool when users want to swap, exchange, convert, or trade tokens. This includes requests like 
    "swap ETH to USDC", "convert ETH to DAI", "trade ETH for tokens", or "exchange ETH for BERA".
    `,
  parameters: parameters,
  execute: async (params, context: ToolContext) => {
    const networkContext = context?.networkContext;
    
    const {
      tokenInSymbol,
      tokenOutSymbol,
      amountInHuman,
      slippage = 0.01
    } = params;
    // Use chainId from networkContext
    const effectiveChainId = networkContext!.selectedChainId;
    const isDemo = networkContext!.isDemo
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
    logContent += `Chain ID: ${effectiveChainId}\n`

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

      // Parse USD amount using common utility
      const usdConversionResult = await parseUsdAmount(amountInHuman, upperTokenInSymbol, { chainId: effectiveChainId })
      const actualAmountInHuman = getEffectiveAmount(usdConversionResult)
      
      if (usdConversionResult.isUsd) {
        logContent += `USD Conversion: $${usdConversionResult.usdAmount} -> ${actualAmountInHuman} ${upperTokenInSymbol}\n`
      }

      if (upperTokenInSymbol === 'ETH') {
        try {
          amountInBaseUnits = ethers.parseEther(actualAmountInHuman).toString()
          actualTokenInAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' // Zero address for ETH
        } catch (error) {
          throw new Error(
            `Invalid ETH amount: ${actualAmountInHuman}. ${
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
            .parseUnits(actualAmountInHuman, tokenInDecimals)
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
          chainId: effectiveChainId,
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
            amountInBaseUnits, evmWalletAddress, effectiveChainId, isDemo)
        if (approvalResult.status === 'fail') {
          throw new Error(approvalResult.message)
        }
      }

      logContent += `Transaction Data: ${JSON.stringify(txData)}\n`
      await logToFile(logFilePath, logContent)

      // TODO: uncomment this when ready
      const result = await executeTransaction(txData, effectiveChainId)

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
          chain_id: effectiveChainId,
          complete_time: completeTime,
          usd_conversion: createUsdConversionInfo(usdConversionResult)
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
          chain_id: effectiveChainId
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

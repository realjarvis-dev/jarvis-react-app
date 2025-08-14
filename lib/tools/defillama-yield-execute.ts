import { tool } from 'ai'
import { z } from 'zod'
import { getUserEvmWalletAddress } from '@/lib/privy/client'
import { NetworkContext } from '@/lib/types/context'
import { lookupPoolLatestData } from '../defillama/pool-lookup'
import { getEnsoTokenFinder } from '../enso/token-finder'
import { crossChainMatcher } from '../token-matcher/cross-chain-matcher'
import { parseUnits } from 'viem'
import { getEnsoClient } from '../enso/client'
import { generateObject } from 'ai';
import { getModel } from '../utils/registry'
import { EnsoClient } from '@ensofinance/sdk'
import { ensoSwap } from '../enso/swap'
import { erc20Approval, executeTransaction } from '../privy/utils'
import { getConfigByChainId } from '../network/config'

interface ToolContext {
  toolCallId?: string
  messages?: any[]
  networkContext?: NetworkContext
}
const SYSTEM_PROMPT = `
You are a professional web researcher with DeFi expertise.
You are given a pool info from defillama, and a list of enso tokens.
You need to determine which enso token represent the pool.
They should have similar name. If there is no match, return null.
If there is a match, return the enso token information
`


export const defillamaYieldQuote = tool({
  description: 'Find and get a quote the user selected defi llama opportunity.',
  parameters: z.object({
    fromToken: z
    .string()
    .describe(
      "The input token for this investment, can be token symbol or token name. don't have to be exact match"
    ),
    amount: z.string().describe('Amount to invest (in token units), human readable format'),
    targetProjectName: z.string().describe('Project name of the target pool to invest in'),
    targetChainName: z.string().describe('Chain name of the target pool to invest in'),
    targetSymbol: z.string().describe('Symbol of the target pool to invest in'),
    sourceChainId: z.number().describe('Current chain ID where input token are located, should be the one in network context'),
    poolId: z.string().describe('Defi Llama pool ID of the target pool to invest in'),

  }),
  execute: async ({ fromToken, amount, sourceChainId, poolId, targetProjectName, targetChainName, targetSymbol }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to use cross-chain optimization' }
        }
      }

      const fromTokenList = await crossChainMatcher.matchToken(sourceChainId, fromToken)
      if (fromTokenList.length === 0) {
        return {
          _uiDisplayTool: true,
          summary: 'No matching input token found',
          data: { error: 'No matching token found' }
        }
      }
      if (fromTokenList.length > 1 && fromTokenList[0].symbol !== fromToken && fromTokenList[0].name !== fromToken) {
        return {
          _uiDisplayTool: true,
          summary: 'Multiple matching input tokens found',
          data: { error: 'Multiple matching tokens found', fromTokenList: fromTokenList }
        }
      }
      const fromTokenMatched = fromTokenList[0]
      let fromTokenAddress;
      if (fromTokenMatched.address === "0x0000000000000000000000000000000000000000") {
        fromTokenAddress = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      } else {
        fromTokenAddress = fromTokenMatched.address
      }
      const fromTokenDecimals = fromTokenMatched.decimals
      const amountInWei = parseUnits(amount, fromTokenDecimals)

      // 1. get defillama pool info
      const poolInfo = await lookupPoolLatestData(poolId)

      // 2. filter enso token use pool info
      const targetChainId = getChainIdFromChainName(targetChainName)
      const ensoTokenFinder = getEnsoTokenFinder()
      const ensoTokenList = await ensoTokenFinder.findToken(targetChainId, poolInfo.tvlUsd, poolInfo.apy, targetProjectName)
      if (ensoTokenList.length === 0) {
        return {
          _uiDisplayTool: true,
          summary: 'No matching enso token found',
          data: { error: 'No matching enso token found' }
        }
      } 
      const userPrompt = ` Defi Llama pool info: ${JSON.stringify(poolInfo)}
Defi Llama pool name: ${targetSymbol}

Enso token list: ${JSON.stringify(ensoTokenList)}
      `
      const result = await generateObject({
        model: getModel('openai:gpt-4o-mini'),
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        schema: z.object({
          found: z.boolean().describe('Whether there is a enso token that match'),
          ensoTokenAddress: z.string().optional().describe('The address of the enso token that match'),
          ensoTokenName: z.string().optional().describe('The name of the enso token that match'),
        })
      })
      console.log(result)
    

      if (!result.object.found) {
        return {
          _uiDisplayTool: true,
          summary: 'No matching enso token found',
          data: { error: 'No matching enso token found' }
        }
      }
      const ensoTokenAddress = result.object.ensoTokenAddress
      const ensoToken = ensoTokenList.find(token => token.address === ensoTokenAddress)
      
      console.log(ensoToken)

      
      // 3. get route
      const ensoClient = getEnsoClient()
      let route
      if (sourceChainId === targetChainId) {
        route = await ensoSwap({
          fromAddress: userAddress,
          tokenIn: fromTokenAddress,
          tokenOut: ensoToken!.address,
          chainId: targetChainId,
          amountIn: amountInWei.toString(),
          slippage: 0.05,
        })
    
      } else {
          route = await ensoSwap({
            fromAddress: userAddress,
            tokenIn: fromTokenAddress,
            tokenOut: ensoToken!.address,
            chainId: sourceChainId,
            destinationChainId: targetChainId,
            amountIn: amountInWei.toString(),
            slippage: 0.05,
          })
      }



      return {
        _uiDisplayTool: false,
        summary: "Found a route, explain it to user",
        data: {
          outputTokenName: ensoToken!.name,
          outputTokenSymbol: ensoToken!.symbol,
          outputTokenDecimals: ensoToken!.decimals,
          outputTokenAddress: ensoToken!.address,
          outputTokenChainId: ensoToken!.chainId,
          inputTokenName: fromTokenMatched.name,
          inputTokenSymbol: fromTokenMatched.symbol,
          inputTokenDecimals: fromTokenMatched.decimals,
          inputTokenAddress: fromTokenAddress,
          inputTokenChainId: sourceChainId,
          amountOut: route.amountOut,
          gas: route.gas,
          route: route.route,
          priceImpact: route.priceImpact,
          feeAmount: route.feeAmount,
          completeTime: new Date().toISOString()
        }
      }

      } catch (error) {
        console.error(error)
        return {
          _uiDisplayTool: true,
          summary: 'Error',
          data: { error: 'Error executing yield execute' }
        }
      }
    }
})

const getChainIdFromChainName = (chainName: string) => {
  const chainId = chainName.toLowerCase()
  if (chainId === 'ethereum') return 1
  if (chainId === 'base') return 8453
  if (chainId === 'arbitrum') return 42161
  if (chainId === 'polygon') return 137
  if (chainId === 'optimism') return 10
  if (chainId === 'bsc') return 56
  if (chainId === 'gnosis') return 100
  if (chainId === 'zksync') return 324
  if (chainId === 'avalanche') return 43114
  if (chainId === 'fantom') return 250
  if (chainId === 'moonbeam') return 1284
  if (chainId === 'moonriver') return 1285
  if (chainId === 'klaytn') return 8217
  if (chainId === 'celo') return 42220
  if (chainId === 'harmony') return 1666600000
  if (chainId === 'move') return 30732
  return 1
}

export const defillamaYieldExecute = tool({
  description: 'Execute defi llama opportunity, use after user confirm the defi llama quote',
  parameters: z.object({
    outputTokenName: z.string().describe('The name of the output token'),
    outputTokenSymbol: z.string().describe('The symbol of the output token'),
    outputTokenDecimals: z.number().describe('The decimals of the output token'),
    outputTokenAddress: z.string().describe('The address of the output token'),
    outputTokenChainId: z.number().describe('The chain ID of the output token'),
    inputTokenName: z.string().describe('The name of the input token'),
    inputTokenSymbol: z.string().describe('The symbol of the input token'),
    inputTokenDecimals: z.number().describe('The decimals of the input token'),
    inputTokenAddress: z.string().describe('The address of the input token'),
    inputTokenChainId: z.number().describe('The chain ID of the input token'),
    amountIn: z.string().describe('Amount to invest (in token units), human readable format'),

  }),
  execute: async ({ outputTokenAddress, outputTokenChainId, outputTokenDecimals, outputTokenName, 
    outputTokenSymbol, inputTokenAddress, inputTokenChainId, inputTokenDecimals, inputTokenName, 
    inputTokenSymbol, amountIn }, context: ToolContext) => {
    try {
      const userAddress = await getUserEvmWalletAddress()
      if (!userAddress) {
        return {
          _uiDisplayTool: true,
          summary: 'Wallet connection required',
          data: { error: 'Please connect your wallet to use cross-chain optimization' }
        }
      }

      const amountInWei = parseUnits(amountIn, inputTokenDecimals)
      const isFromNativeToken = inputTokenAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" || inputTokenAddress === "0x0000000000000000000000000000000000000000"
      if (inputTokenAddress === "0x0000000000000000000000000000000000000000") {
        inputTokenAddress = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      }

      const isCrossChain = inputTokenChainId !== outputTokenChainId
      let route;
      if (isCrossChain) {
        route = await ensoSwap({
          fromAddress: userAddress,
          tokenIn: inputTokenAddress,
          tokenOut: outputTokenAddress,
          chainId: inputTokenChainId,
          destinationChainId: outputTokenChainId,
          amountIn: amountInWei.toString(),
          slippage: 0.05,
        })
      } else {
        route = await ensoSwap({
          fromAddress: userAddress,
          tokenIn: inputTokenAddress,
          tokenOut: outputTokenAddress,
          chainId: inputTokenChainId,
          amountIn: amountInWei.toString(),
          slippage: 0.05,
        })
      }

      const to = route.tx.to
      const isDemo = context.networkContext?.isDemo || false
      if (!isFromNativeToken) {
        const approvalResult = await erc20Approval(inputTokenAddress, to, amountInWei.toString(), userAddress, inputTokenChainId,  isDemo)
        if (approvalResult.status === "fail") {
          return {
            _uiDisplayTool: true,
            summary: 'Error',
            data: { error: `Error approving token: ${approvalResult.message}` }
          }
        }
      }


      const executeResult = await executeTransaction(route.tx, inputTokenChainId, {
        estimateGas: true,
      }, isDemo)
      const explorerLink = getConfigByChainId(inputTokenChainId, isDemo).scanLink
      const explorerLinkWithHash = `https://${explorerLink}/tx/${executeResult.hash}`

      return {
        _uiDisplayTool: false,
        summary: 'Transaction executed',
        data: {
          txHash: executeResult.hash,
          explorerLink: explorerLink ? explorerLinkWithHash : undefined,
          completeTime: new Date().toISOString()
        }
      }



    } catch (error) {
      console.error(error)
      return {
        _uiDisplayTool: true,
        summary: 'Error',
        data: { error: 'Error executing yield execute' }
      }
    }
  }
})
import { getConfigByChainId } from '@/lib/network/config'
import { WalletWithMetadata } from '@privy-io/server-auth'
import { tool } from 'ai'
import { ethers } from 'ethers'
import { parseUnits } from 'viem'
import { z } from 'zod'
import { getGasPriceByChainId } from '../blocknative/get-gas-price'
import { getUserId, getUserWallet } from '../privy/client'
import { balanceChangePub } from '../pubsub/balance-change-pub'
import { ToolContext } from '../types/context'
import { findTokenInUserWalletByIdentifier } from '../token-matcher/token-utils'
import { erc20Transfer, executeTransaction } from '../privy/utils'

export const privyTransferTool = tool({
  description: 'Transfer native token or erc20 token to a specified address',
  parameters: z.object({
    address: z.string().describe('The address to transfer funds to'),
    identifier: z
      .string()
      .describe('The symbol or name or address of the token to transfer'),
    amount: z
      .number()
      .describe('The amount of token to transfer, in human readable format')
  }),
  execute: async (params, context: ToolContext) => {
    const { address, amount, identifier } = params
    const networkContext = context.networkContext!
    const evmWallet: WalletWithMetadata | undefined = await getUserWallet(
      'ethereum'
    )

    const isDemo = networkContext!.isDemo

    if (!evmWallet) {
      return {
        status: 'fail',
        error_message: 'No EVM wallet available',
        hash: null
      }
    }
    if (!evmWallet?.delegated) {
      return {
        status: 'fail',
        error_message: 'EVM wallet not delegated',
        hash: null
      }
    }
    // determine if the token is native or erc20
    try {
      const nativeTokenSymbol = networkContext.config.nativeAsset.symbol
      const nativeTokenName = networkContext.config.nativeAsset.name
      const nativeTokenAddress = '0x0000000000000000000000000000000000000000'
      const isNativeToken =
        identifier === nativeTokenSymbol ||
        identifier === nativeTokenName ||
        identifier === nativeTokenAddress
      if (isNativeToken) {
        const nativeTokenDecimal = networkContext.config.nativeAsset.decimals
        // convert amount to wei
        const amountInWei = parseUnits(amount.toString(), nativeTokenDecimal)
        const chainId = networkContext?.selectedChainId || 1
        const tx = await executeTransaction(
          {
            from: evmWallet.address,
            to: address as `0x${string}`,
            value: amountInWei,
            data: '0x'
          },
          chainId,
          {
            estimateGas: false,
            gasLimit: ethers.toQuantity(21000) as `0x${string}`,
            eip1559GasPriceFunction: getGasPriceByChainId
          },
          isDemo
        )
        const explorerLink = getConfigByChainId(chainId, isDemo).scanLink
        const explorerLinkWithHash = `https://${explorerLink}/tx/${tx.hash}`
        const userId = await getUserId()
        balanceChangePub(userId, [networkContext.config.id], isDemo)
        return {
          status: 'success',
          hash: tx.hash,
          transaction_details: {
            to: address,
            amount: amount,
            complete_time: new Date().toISOString(),
            chain_id: chainId,
            chain_explorer_name: `${
              getConfigByChainId(chainId, isDemo).displayName
            } explorer`,
            explorer_link: explorerLink ? explorerLinkWithHash : undefined
          },
          error_message: ''
        }
        // transfer native token
      } else {
        // transfer erc20 token
        // fetch wallet balance
        const tokenResult = await findTokenInUserWalletByIdentifier(
          identifier,
          evmWallet.address,
          networkContext.selectedChainId,
          isDemo
        )

        if (tokenResult.status === 'fail') {
          return {
            status: 'fail',
            error_message: tokenResult.error_message,
            hash: null
          }
        }

        const token = tokenResult.token!
        const amountInWei = parseUnits(
          amount.toString(),
          token.decimals
        ).toString()

        const { status, hash, message } = await erc20Transfer(
          token.address,
          address,
          amountInWei,
          evmWallet.address,
          networkContext.selectedChainId,
          isDemo
        )
        const explorerLink = getConfigByChainId(
          networkContext.selectedChainId,
          isDemo
        ).scanLink
        const explorerLinkWithHash = `https://${explorerLink}/tx/${hash}`

        if (status === 'success') {
          const userId = await getUserId()
          balanceChangePub(userId, [networkContext.config.id], isDemo)

          return {
            status: 'success',
            hash: hash,
            transaction_details: {
              to: address,
              amount: amount,
              complete_time: new Date().toISOString(),
              chain_id: networkContext.selectedChainId,
              chain_explorer_name: `${
                getConfigByChainId(networkContext.selectedChainId, isDemo)
                  .displayName
              } explorer`,
              explorer_link: explorerLink ? explorerLinkWithHash : undefined
            },
            error_message: ''
          }
        } else {
          return {
            status: 'fail',
            error_message: message,
            hash: hash
          }
        }
      }
    } catch (error) {
      console.error('Transaction error: ', error)
      return {
        status: 'fail',
        error_message: error instanceof Error ? error.message : String(error),
        hash: ''
      }
    }
  }
})

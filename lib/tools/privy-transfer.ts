import { WalletWithMetadata } from '@privy-io/server-auth'
import { tool } from 'ai'
import { ethers } from 'ethers'
import { parseEther } from 'viem'
import { z } from 'zod'
import { getGasPriceByChainId } from '../blocknative/get-gas-price'
import { executeSwapTransaction } from '../pendle/transactions'
import { getUserWallet } from '../privy/client'
import { getConfigByChainId } from '../config/network'

import { ToolContext } from '../types/context'

export const privyTransferTool = tool({
  description: 'Transfer funds to a specified address',
  parameters: z.object({
    address: z.string().describe('The address to transfer funds to'),
    amount: z
      .number()
      .describe('The amount of ETH in the unit of ETH to transfer')
  }),
  execute: async (params, context: ToolContext) => {
    const { address, amount } = params
    const networkContext = context?.networkContext
    const evmWallet: WalletWithMetadata | undefined = await getUserWallet(
      'ethereum'
    )
    // console.log('Transfer amount: ', amount)
    // console.log('Transfer address: ', address)
    console.log('networkContext in privy transfer', networkContext)

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
    console.log('EVM wallet', evmWallet)
    try {
      // // strip 0x prefix from address
      // const addressWithoutPrefix = address.replace('0x', '')

      // convert amount to wei
      const amountInWei = parseEther(amount.toString())

      const chainId = networkContext?.selectedChainId || 1
      console.log('amountInWei', amountInWei)
      console.log('chainId', chainId)
      console.log('from', evmWallet.address)
      console.log('to', address)
      const tx = await executeSwapTransaction(
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
          getGasPriceFunction: getGasPriceByChainId
        }
      )

      return {
        status: 'success',
        hash: tx.hash,
        transaction_details: {
          to: address,
          amount: amount,
          complete_time: new Date().toISOString(),
          chainId: chainId,
          chainExplorerName:
            networkContext?.selectedNetwork === 'demo'
              ? 'demo dashboard'
              : `${getConfigByChainId(chainId).displayName} explorer`
        },
        error_message: ''
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

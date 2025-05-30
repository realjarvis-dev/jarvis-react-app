import AggregatorV3InterfaceABI from '@chainlink/contracts/abi/v0.8/AggregatorV3Interface.json'
import { WalletWithMetadata } from '@privy-io/server-auth'
import { tool } from 'ai'
import { ethers } from 'ethers'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { getUserWallet } from '../privy/client'
import { executeSwapTransaction } from '../pendle/transactions'

export const privyTransferTool = tool({
  description: 'Transfer funds to a specified address',
  parameters: z.object({
    address: z.string().describe('The address to transfer funds to'),
    amount: z
      .number()
      .describe('The amount of ETH in the unit of ETH to transfer')
  }),
  execute: async ({ address, amount }) => {
    const evmWallet: WalletWithMetadata | undefined = await getUserWallet(
      'ethereum'
    )
    console.log('Transfer amount: ', amount)
    console.log('Transfer address: ', address)

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
      const idempotencyKey = uuidv4()

      // strip 0x prefix from address
      const addressWithoutPrefix = address.replace('0x', '')

      // convert amount to wei
      const amountInWei = amount * 10 ** 18

      // console.log(NetworkConfig)

      const hash = await executeSwapTransaction({
        from: evmWallet.address,
        to: `0x${addressWithoutPrefix}`,
        value: amountInWei,
        data: '0x'
      }, 1, {
        estimateGas: false,
        gasLimit: ethers.toQuantity(21000) as `0x${string}`
      })

      // const { hash } = await privy.walletApi.ethereum.sendTransaction({
      //   walletId: evmWallet?.id || '',
      //   caip2: `eip155:${NetworkConfig.chainId}`,
      //   transaction: {
      //     to: `0x${addressWithoutPrefix}`,
      //     value: amountInWei,
      //     gasLimit: 21000,
      //     chainId: NetworkConfig.chainId
      //   },
      //   idempotencyKey: idempotencyKey // unique key for this transaction
      // })
      console.log('Transaction send, hash: ', hash)
      return { status: 'success', hash: hash, error_message: '' }
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

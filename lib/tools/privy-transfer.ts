import AggregatorV3InterfaceABI from '@chainlink/contracts/abi/v0.8/AggregatorV3Interface.json'
import { WalletWithMetadata } from '@privy-io/server-auth'
import { tool } from 'ai'
import { ethers } from 'ethers'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { NetworkConfig } from '../config/network'
import { getUserWallet, privy } from '../privy/client'

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

      console.log(NetworkConfig)

      const { hash } = await privy.walletApi.ethereum.sendTransaction({
        walletId: evmWallet?.id || '',
        caip2: `eip155:${NetworkConfig.chainId}`,
        transaction: {
          to: `0x${addressWithoutPrefix}`,
          value: amountInWei,
          chainId: NetworkConfig.chainId
        },
        idempotencyKey: idempotencyKey // unique key for this transaction
      })
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

const RPC_URL = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com'
const FEED_ADDRESS = ethers.getAddress(
  '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419'
)

export async function fetchEthUsdPrice(): Promise<{
  price: ethers.BigNumberish
  decimals: number
}> {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  // Attach ABI, not interface type
  const feed = new ethers.Contract(
    FEED_ADDRESS,
    AggregatorV3InterfaceABI,
    provider
  )

  // latestRoundData() returns a struct:
  // { roundId, answer, startedAt, updatedAt, answeredInRound }
  const roundData = await feed.latestRoundData()
  const decimals: number = await feed.decimals()
  return { price: roundData.answer, decimals }
}

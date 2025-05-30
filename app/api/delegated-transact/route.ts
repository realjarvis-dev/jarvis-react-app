export const runtime = 'nodejs'
import { TenderlyDemoConfig } from '@/lib/config/network'
import { getUserWallet, privy } from '@/lib/privy/client'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import {
  populateTransactionRequest
} from '@privy-io/js-sdk-core'
import { WalletWithMetadata } from '@privy-io/server-auth'
import { ethers } from 'ethers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const evmWallet: WalletWithMetadata | undefined = await getUserWallet(
    'ethereum'
  )

  if (!evmWallet?.delegated) {
    return NextResponse.json({ error: 'Not delegated' }, { status: 401 })
  }

  if (!evmWallet) {
    return NextResponse.json({ error: 'No evm wallet' }, { status: 401 })
  }

  try {
    // 1. Create data payload for transaction
    const recipientAddress = '0xa9516C8AA7425D6190345a038eB8C4799C786Bb8'
    const chainId = TenderlyDemoConfig.chainId // Tenderly demo network
    const weiBig = BigInt('1000000000000000') // 0.001 ETH in wei

    // Create base transaction request
    const txRequest = {
      to: recipientAddress,
      value: ethers.toQuantity(weiBig),
      chainId: chainId
    }

    console.log('Transaction request created:', txRequest)

    // 2. Set up provider and populate transaction request
    const rpcUrl = TenderlyDemoConfig.rpcUrl
    const provider = new StaticJsonRpcProvider(rpcUrl, {
      name: 'tenderly-demo',
      chainId: chainId
    })

    // Get the wallet address
    const walletAddress = evmWallet?.address || ''

    // Populate transaction request with gas parameters
    const populatedTxRequest = await populateTransactionRequest(
      walletAddress,
      txRequest,
      provider
    )

    console.log('Populated transaction request:', populatedTxRequest)

    // // 3. Calculate gas estimation
    // const { totalGasEstimate, l1ExecutionFeeEstimate } =
    //   await calculateTotalGasEstimate(populatedTxRequest, provider)

    // console.log('Total gas estimate:', totalGasEstimate.toString())
    // console.log('L1 execution fee estimate:', l1ExecutionFeeEstimate.toString())

    // 4. Send the transaction with the calculated gas limit - using a safe default based on estimate
    const gasLimitWithBuffer = 650000 // Safe default gas limit

    // Passing value directly as a number - 1000000000000000 wei (0.001 ETH)
    const { hash } = await privy.walletApi.ethereum.sendTransaction({
      walletId: evmWallet?.id || '',
      caip2: `eip155:${chainId}`,
      transaction: {
        to: recipientAddress,
        value: 1000000000000000, // Value as a number instead of hex string
        chainId: chainId,
        gasLimit: gasLimitWithBuffer
      },
      idempotencyKey: `tx-${Date.now()}` // unique key for this transaction
    })

      console.log('Transaction sent, hash:', hash)

    return NextResponse.json(
      {
        hash,

      },
      { status: 200 }
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Error processing transaction' },
      { status: 500 }
    )
  }
}

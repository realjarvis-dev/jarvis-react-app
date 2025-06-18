export const runtime = 'nodejs'
import { bnbSmartChainConfig, TENDERLY_DEMO_CONFIG } from '@/lib/network/config'
import { getUserWallet, privy } from '@/lib/privy/client'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import {
  populateTransactionRequest
} from '@privy-io/js-sdk-core'
import { WalletWithMetadata } from '@privy-io/server-auth'
import { ethers, JsonRpcProvider } from 'ethers'
import { NextRequest, NextResponse } from 'next/server'
import { parseUnits } from 'viem'

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
    const recipientAddress = '0xFb697a5eD9cdbbA684511774416cf4424052dC45'
    const chainId = bnbSmartChainConfig.chainId 
    const weiBig = parseUnits('0.00001', 18)

    // Create base transaction request
    const txRequest = {
      from: evmWallet?.address,
      to: recipientAddress,
      value: weiBig,
      chainId: chainId
    }

    console.log('Transaction request created:', txRequest)

    // 2. Set up provider and populate transaction request
    const rpcUrl = bnbSmartChainConfig.rpcUrl
    const provider = new JsonRpcProvider(rpcUrl)

    // Get the wallet address
    const walletAddress = evmWallet?.address || ''

    // // Populate transaction request with gas parameters
    // const populatedTxRequest = await populateTransactionRequest(
    //   walletAddress,
    //   txRequest,
    //   provider
    // )

    // console.log('Populated transaction request:', populatedTxRequest)

    // // 3. Calculate gas estimation
    // const { totalGasEstimate, l1ExecutionFeeEstimate } =
    //   await calculateTotalGasEstimate(populatedTxRequest, provider)

    // console.log('Total gas estimate:', totalGasEstimate.toString())
    // console.log('L1 execution fee estimate:', l1ExecutionFeeEstimate.toString())

    // 4. Send the transaction with the calculated gas limit - using a safe default based on estimate
    // const gasLimitWithBuffer = 650000 // Safe default gas limit

    // Passing value directly as a number - 1000000000000000 wei (0.001 ETH)
    const { signedTransaction, encoding } = await privy.walletApi.ethereum.signTransaction({
      walletId: evmWallet?.id || '',
      transaction: {
        type: 0,
        gasLimit: 21000,
        gasPrice: ethers.toQuantity(ethers.parseUnits("0.1", "gwei")) as `0x${string}`,
        nonce: await provider.getTransactionCount(evmWallet?.address, 'pending'),
        to: txRequest.to as `0x${string}`,
        value: ethers.toQuantity(txRequest.value) as `0x${string}`,
        chainId: txRequest.chainId,
        from: txRequest.from as `0x${string}`
      },
      idempotencyKey: `tx-${Date.now()}` // unique key for this transaction
    })

    console.log("evmWallet?.address", evmWallet?.address)
    console.log("rpc url", rpcUrl)
    console.log("nonce", await provider.getTransactionCount(evmWallet?.address, 'pending'))
    console.log("confirmed nonce", await provider.getTransactionCount(evmWallet?.address))

    
    // const tx = await provider.broadcastTransaction(signedTransaction)
    // console.log("tx hash", tx.hash)
    // await tx.wait()
    // console.log("tx confirmed")

    // console.log('Transaction signed, hash:', signedTransaction)

    return NextResponse.json(
      {
        signedTransaction,
        // hash: tx.hash,
        encoding
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

import {
  type Account,
  createWalletClient,
  EIP1193RequestFn,
  http,
  WalletRpcSchema,
  zeroAddress
} from 'viem'
import { parseAccount } from 'viem/accounts'

import {
  type Address,
  getUnwrappedToken,
  MarketParams
} from '@morpho-org/blue-sdk'
import '@morpho-org/blue-sdk-viem/lib/augment'
import {
  type BundlingOptions,
  type InputBundlerOperation,
  encodeBundle,
  finalizeBundle,
  populateBundle
} from '@morpho-org/bundler-sdk-viem'
import { withSimplePermit } from '@morpho-org/morpho-test'
import {
  isBlueOperation,
  isErc20Operation,
  isMetaMorphoOperation,
  SimulationState
} from '@morpho-org/simulation-sdk'
import { TransactionRequest } from 'ethers'
import { mainnet } from 'viem/chains'
import { privy } from '../privy/client'
import { executeTransaction } from '../privy/utils'

export const setupBundle = async (
  userAddress: Address,
  userWalletId: string,
  startData: SimulationState,
  inputOperations: InputBundlerOperation[],
  {
    account: account_ = userAddress,
    supportsSignature,
    unwrapTokens,
    unwrapSlippage,
    onBundleTx,
    ...options
  }: BundlingOptions & {
    account?: Address | Account
    supportsSignature?: boolean
    unwrapTokens?: Set<Address>
    unwrapSlippage?: bigint
    onBundleTx?: (data: SimulationState) => Promise<void> | void
  } = {}
) => {
  if (!account_) throw new Error('Account is required')
  const account =
    typeof account_ === 'string' ? { address: account_ as Address } : account_
  // 1. Build and optimize the operations bundle
  let { operations } = populateBundle(inputOperations, startData, {
    ...options,
    withSimplePermit: new Set([
      ...withSimplePermit[startData.chainId],
      ...(options.withSimplePermit ?? [])
    ]),
    publicAllocatorOptions: {
      enabled: true,
      ...options.publicAllocatorOptions
    }
  })
  operations = finalizeBundle(
    operations,
    startData,
    account.address,
    unwrapTokens,
    unwrapSlippage
  )

  // 2. Encode the optimized bundle; supportsSignature indicates whether EIP-712 requirements should be returned
  const bundle = encodeBundle(operations, startData, supportsSignature)

  // 3. Collect involved tokens (same as original)
  const tokens = new Set<Address>()
  for (const op of operations) {
    const { address } = op
    if (isBlueOperation(op) && op.type !== 'Blue_SetAuthorization') {
      const mp = MarketParams.get(op.args.id)
      if (mp.loanToken !== zeroAddress) tokens.add(mp.loanToken)
      if (mp.collateralToken !== zeroAddress) tokens.add(mp.collateralToken)
    }
    if (isMetaMorphoOperation(op)) {
      tokens.add(address)
      const vault = startData.tryGetVault(address)
      if (vault) tokens.add(vault.asset)
    }
    if (isErc20Operation(op)) {
      tokens.add(address)
      const unwrapped = getUnwrappedToken(address, startData.chainId)
      if (unwrapped) tokens.add(unwrapped)
    }
  }

  // 4. Optional hook before sending
  await onBundleTx?.(startData)
  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(), // only needed to satisfy the type
    account: parseAccount(userAddress) // gives it .account.address
  })

  const origRequest = walletClient.request.bind(walletClient)

  const privyRequest = async <M extends keyof WalletRpcSchema>(
    args: Parameters<EIP1193RequestFn<WalletRpcSchema>>[0]
  ): Promise<ReturnType<EIP1193RequestFn<WalletRpcSchema>>> => {
    const { method, params } = args
    if (method === 'eth_signTypedData_v4' || method === 'eth_signTypedData') {
      const typedData =
        typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1]
      const { signature } = await privy.walletApi.ethereum.signTypedData({
        walletId: userWalletId,
        typedData
      })
      // TS thinks ReturnType<> might not be string, so we cast:
      return signature as any
    }
    // fallback to the original RPC call
    return origRequest({ method, params }) as any
  }

  // Force it into the WalletClient
  walletClient.request =
    privyRequest as unknown as EIP1193RequestFn<WalletRpcSchema>

  // 5. Sign any EIP-712 / “simple permit” requirements via Privy
  for (const req of bundle.requirements.signatures) {
    await req.sign(walletClient)
  }

  // 6. Gather pre-req txs + final bundle tx
  const txsToSend = [
    ...bundle.requirements.txs.map(({ tx }) => tx),
    bundle.tx()
  ]

  // // 7. Sign & broadcast each tx with your Privy helper
  const results = []
  for (const txRequest of txsToSend) {
    txRequest.from = userAddress
    const { hash } = await executeTransaction(
      txRequest as TransactionRequest,
      startData.chainId,
      { estimateGas: true },
      true,
      60000,
      userWalletId,
      userAddress
    )
    results.push(hash)
  }
  return { operations, bundle, receipts: results }
}

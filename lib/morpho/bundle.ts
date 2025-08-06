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
  addresses,
  ChainId,
  DEFAULT_SLIPPAGE_TOLERANCE,
  getChainAddresses,
  getUnwrappedToken,
  MarketId,
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
import { buildSimulatedState } from './get-simulation-state'
const { dai } = getChainAddresses(ChainId.EthMainnet)

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
  console.log('==========account==========')
  console.log(account)
  console.log('====inputOperations==========')
  console.log(inputOperations)
  console.log('==========startData==========')
  console.log(startData)
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
  console.log('==========operations==========')
  console.log(operations)
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
  ): ReturnType<EIP1193RequestFn<WalletRpcSchema>> => {
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
    console.log('==========req==========')
    console.log(req)
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
    console.log('==========txRequest==========')
    const { hash } = await executeTransaction(
      txRequest as TransactionRequest,
      startData.chainId,
      { estimateGas: true },
      true,
      60000,
      userWalletId,
      userAddress
    )
    console.log('==========hash==========')
    console.log(hash)
    results.push(hash)
  }
  return { operations, bundle, receipts: results }
}

const { morpho } = addresses[ChainId.EthMainnet]
console.log('MORPHO', morpho)
/**
 * Executes a series of Morpho operations: supply collateral, and borrow
 * @param marketId - The ID of the market to interact with
 * @param userAddress - The address of the user
 * @param simulationState - The current simulation state
 * @param amountSupplyCollateral - Amount to supply as collateral
 * @param amountBorrow - Amount to borrow
 * @returns Array of transaction responses
 */
export const supplyCollateralBorrow = async (
  marketId: MarketId,
  userAddress: Address,
  userWalletId: string,
  simulationState: SimulationState,
  amountSupply: bigint,
  amountSupplyCollateral: bigint,
  amountBorrow: bigint
) => {
  return setupBundle(userAddress, userWalletId, simulationState, [
    // {
    //   type: 'Blue_Supply',
    //   sender: userAddress,
    //   address: morpho,
    //   args: {
    //     id: marketId,
    //     assets: amountSupply,
    //     onBehalf: userAddress,
    //     slippage: DEFAULT_SLIPPAGE_TOLERANCE
    //   }
    // },
    {
      type: 'Blue_SupplyCollateral',
      sender: userAddress,
      address: morpho,
      args: {
        id: marketId,
        assets: amountSupplyCollateral,
        onBehalf: userAddress
      }
    },
    {
      type: 'Blue_Borrow',
      sender: userAddress,
      address: morpho,
      args: {
        id: marketId,
        assets: amountBorrow,
        onBehalf: userAddress,
        receiver: userAddress,
        slippage: DEFAULT_SLIPPAGE_TOLERANCE
      }
    }
  ])
}

const userAddress = '0x20dC1B6732E7A20aCba461BD37beead4FF5D93c8'

const inputSimulationState = await buildSimulatedState(
  '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc' as MarketId,
  [userAddress, '0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077'],
  1,
  'http://localhost:8545'
)
const simulationState = new SimulationState(inputSimulationState)

console.log(
  await supplyCollateralBorrow(
    '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc' as MarketId,
    userAddress,
    'u6g0wul9ios8ga92x4qqojqg',
    simulationState,
    BigInt(100000),
    BigInt(5000000000000000),
    BigInt(1000)
  )
)

console.log('==========PROGRAM COMPLETE==========')

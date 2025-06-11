export interface NormalizedSwapInfo {
  title: string
  isBridge: boolean

  // For pending view, from args
  fromTokenName: string
  toTokenName: string // for SwapTransactionStatus tokenName
  fromAmount: string
  fromChainName?: string
  toChainName?: string
  fromChainId?: number // for SwapTransactionStatus chainId

  // for result view
  status: 'confirmed' | 'failed' | 'pending'
  error?: string
  txHash?: string
  explorerLink?: string
  completeTime?: string

  // For confirmed view
  sentDisplay?: string
  receivedDisplay?: string
}

export function normalizeSwapInfo(
  tool: any,
  currentChainId?: number
): NormalizedSwapInfo | null {
  const result = tool.result
    ? typeof tool.result === 'string'
      ? JSON.parse(tool.result)
      : tool.result
    : null
  // lifi args are stringified json
  const args = tool.args
    ? typeof tool.args === 'string'
      ? JSON.parse(tool.args)
      : tool.args
    : {}

  // tool type detection
  let toolType: 'pendle' | 'lifi' | undefined
  if (tool.toolName === 'pendle_swap') {
    toolType = 'pendle'
  } else if (tool.toolName === 'lifi_bridge_execute') {
    toolType = 'lifi'
  } else {
    // fallback detection
    if (result?.swap_details?.from_chain_name || args?.fromChainName) {
      toolType = 'lifi'
    } else if (result?.data?.swap_details || args?.market_address) {
      toolType = 'pendle'
    }
  }

  if (toolType === 'pendle') {
    const data = result?.data || result // pendle results are wrapped in `data`

    const fromTokenName =
      args.input_token_name_display || data?.swap_details?.from || 'Token'
    const toTokenName =
      args.output_token_name_display || data?.swap_details?.to || 'Token'
    const fromAmount = args.amount_in_human

    const chainId = data?.swap_details?.chainId || currentChainId

    if (tool.state === 'call') {
      return {
        title: 'Swap Transaction',
        isBridge: false,
        fromTokenName,
        toTokenName,
        fromAmount,
        status: 'pending',
        fromChainId: chainId
      }
    }

    if (data?.success) {
      return {
        title: 'Swap Transaction',
        isBridge: false,
        fromTokenName: data.swap_details.from,
        toTokenName: data.swap_details.to,
        fromAmount: args.amount_in_human,
        status: 'confirmed',
        txHash: data.transaction_hash,
        explorerLink: data.swap_details.explorer_link,
        completeTime: data.swap_details.complete_time,
        sentDisplay: data.swap_details.amount_in, // This already contains unit like "1 ETH"
        receivedDisplay: data.swap_details.to,
        fromChainId: data.swap_details.chainId
      }
    }
    if (data && !data.success) {
      return {
        title: 'Swap Transaction',
        isBridge: false,
        fromTokenName,
        toTokenName,
        fromAmount,
        status: 'failed',
        error: data.error || 'Transaction failed',
        fromChainId: chainId
      }
    }
  }

  if (toolType === 'lifi') {
    const isBridge = args.fromChainName !== args.toChainName
    const title = isBridge ? 'Bridge' : 'Swap'

    // From args
    const fromTokenName = args.fromToken?.toUpperCase()
    const toTokenName = args.toToken?.toUpperCase()
    const fromAmount = args.amountIn
    const fromChainName = args.fromChainName
    const toChainName = args.toChainName
    const fromChainId = args.fromChainId

    if (tool.state === 'call') {
      return {
        title,
        isBridge,
        fromTokenName,
        toTokenName,
        fromAmount,
        fromChainName,
        toChainName,
        status: 'pending',
        fromChainId
      }
    }

    if (result?.success) {
      const sd = result.swap_details
      return {
        title: `${title} Successful`,
        isBridge,
        fromTokenName: sd.from_token_symbol.toUpperCase(),
        toTokenName: toTokenName, // result doesn't have to_token_symbol
        fromAmount: sd.amount_in_human,
        fromChainName: sd.from_chain_name,
        toChainName: sd.to_chain_name,
        status: 'confirmed',
        txHash: result.transaction_hash,
        explorerLink: sd.explorer_link,
        completeTime: sd.complete_time,
        sentDisplay:
          `${sd.amount_in_human} ${sd.from_token_symbol.toUpperCase()}` +
          (isBridge ? ` on ${sd.from_chain_name}` : ''),
        receivedDisplay:
          `${toTokenName}` + (isBridge ? ` on ${sd.to_chain_name}` : ''),
        fromChainId
      }
    }
    if (result && !result.success) {
      const sd = result.swap_details
      return {
        title: `${title} Failed`,
        isBridge,
        fromTokenName,
        toTokenName,
        fromAmount,
        fromChainName: sd?.from_chain_name || fromChainName,
        toChainName: sd?.to_chain_name || toChainName,
        status: 'failed',
        error: result.error || 'Transaction failed',
        sentDisplay:
          `${sd?.amount_in_human || fromAmount} ${
            sd?.from_token_symbol?.toUpperCase() || fromTokenName
          }` + (isBridge ? ` on ${sd?.from_chain_name || fromChainName}` : ''),
        receivedDisplay:
          `${toTokenName}` +
          (isBridge ? ` on ${sd?.to_chain_name || toChainName}` : ''),
        fromChainId
      }
    }
  }

  return null
}

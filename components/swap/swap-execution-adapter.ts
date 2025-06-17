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
  if (tool.toolName === 'pendle_swap' || tool.toolName === 'pendle_mint_py' || tool.toolName === 'pendle_mint_sy' || tool.toolName === 'pendle_redeem') {
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

    // Determine title based on tool type
    let title: string
    if (tool.toolName === 'pendle_mint_py') {
      title = 'Mint Transaction'
    } else if (tool.toolName === 'pendle_mint_sy') {
      title = 'SY Mint Transaction'
    } else if (tool.toolName === 'pendle_redeem') {
      title = 'Redeem Transaction'
    } else {
      title = 'Swap Transaction'
    }

    // Extract token names based on tool type
    let fromTokenName: string
    let toTokenName: string
    
    if (tool.toolName === 'pendle_mint_py') {
      // For mint: input token -> PT + YT
      fromTokenName = args.token_type === 'sy' ? 'SY' : (args.input_token_name_display || 'Token')
      toTokenName = `PT + YT`
    } else if (tool.toolName === 'pendle_mint_sy') {
      // For SY mint: input token -> SY
      fromTokenName = args.input_token_name_display || 'Token'
      toTokenName = 'SY'
    } else if (tool.toolName === 'pendle_redeem') {
      // For unified redeem: input tokens -> output tokens
      if (args.token_input_type === 'py') {
        fromTokenName = `PT + YT`
        toTokenName = args.token_output_type === 'sy' ? 'SY' : 'Token'
      } else {
        fromTokenName = 'SY'
        toTokenName = 'Token' // SY can only redeem to underlying
      }
    } else {
      // For swap: existing logic
      fromTokenName = args.input_token_name_display || data?.swap_details?.from || 'Token'
      toTokenName = args.output_token_name_display || data?.swap_details?.to || 'Token'
    }

    const fromAmount = args.amount_in_human

    const chainId = data?.swap_details?.chainId || data?.mint_details?.chainId || data?.redeem_details?.chainId || currentChainId

    if (tool.state === 'call') {
      return {
        title,
        isBridge: false,
        fromTokenName,
        toTokenName,
        fromAmount,
        status: 'pending',
        fromChainId: chainId
      }
    }

    if (data?.success) {
      // Extract transaction details based on tool type
      let transactionHash: string | undefined
      let explorerLink: string | undefined
      let completeTime: string | undefined
      let sentDisplay: string | undefined
      let receivedDisplay: string | undefined

      if (tool.toolName === 'pendle_mint_py') {
        const mintDetails = data.mint_details
        transactionHash = data.transaction_hash
        explorerLink = mintDetails?.explorer_link
        completeTime = mintDetails?.complete_time
        sentDisplay = `${args.amount_in_human} ${args.token_type === 'sy' ? 'SY' : 'tokens'}`
        receivedDisplay = `PT + YT (${mintDetails?.market || 'Market'})`
      } else if (tool.toolName === 'pendle_mint_sy') {
        const mintDetails = data.mint_details
        transactionHash = data.transaction_hash
        explorerLink = mintDetails?.explorer_link
        completeTime = mintDetails?.complete_time
        sentDisplay = `${args.amount_in_human} tokens`
        receivedDisplay = 'SY tokens'
      } else if (tool.toolName === 'pendle_redeem') {
        const redeemDetails = data.redeem_details
        transactionHash = data.transaction_hash
        explorerLink = redeemDetails?.explorer_link
        completeTime = redeemDetails?.complete_time
        if (args.token_input_type === 'py') {
          sentDisplay = `${args.amount_in_human} PT + YT`
          receivedDisplay = args.token_output_type === 'sy' ? 'SY' : 'tokens'
        } else {
          sentDisplay = `${args.amount_in_human} SY`
          receivedDisplay = 'tokens'
        }
      } else {
        // For swap: existing logic
        const swapDetails = data.swap_details
        transactionHash = data.transaction_hash
        explorerLink = swapDetails?.explorer_link
        completeTime = swapDetails?.complete_time
        sentDisplay = swapDetails?.amount_in || `${args.amount_in_human} ${fromTokenName}`
        receivedDisplay = swapDetails?.to || toTokenName
      }

      return {
        title,
        isBridge: false,
        fromTokenName,
        toTokenName,
        fromAmount: args.amount_in_human,
        status: 'confirmed',
        txHash: transactionHash,
        explorerLink,
        completeTime,
        sentDisplay,
        receivedDisplay,
        fromChainId: chainId
      }
    }
    if (data && !data.success) {
      return {
        title,
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

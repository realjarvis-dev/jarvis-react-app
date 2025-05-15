'use client'

import { TokenData } from '@/lib/alchemy/types'
import { ToolInvocation } from 'ai'
import { useEffect, useState } from 'react'
import { WalletBalance } from './wallet-balance'
import { CollapsibleMessage } from './collapsible-message'

interface WalletBalanceToolResult {
  success: boolean
  message: string
  tokens: TokenData[]
  filtered?: boolean
  filter_symbol?: string
}

interface WalletBalanceSectionProps {
  tool: ToolInvocation // Reverted to non-generic
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletBalanceSection({
  // eslint-disable-line
  tool,
  isOpen, // eslint-disable-line @typescript-eslint/no-unused-vars
  onOpenChange // eslint-disable-line @typescript-eslint/no-unused-vars
}: WalletBalanceSectionProps) {
  const [walletAddressArg, setWalletAddressArg] = useState<string | undefined>(
    undefined
  )
  const [tokenSymbolArg, setTokenSymbolArg] = useState<string | undefined>(
    undefined
  )

  const [tokens, setTokens] = useState<TokenData[] | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isFilteredView, setIsFilteredView] = useState(false)
  const [displaySymbol, setDisplaySymbol] = useState<string | undefined>(
    undefined
  )

  useEffect(() => {
    // Get wallet address and token symbol from the tool call arguments
    if (tool.args) {
      const args = (
        typeof tool.args === 'string' ? JSON.parse(tool.args) : tool.args
      ) as { wallet_address?: string; token_symbol?: string } // Type assertion

      setWalletAddressArg(args.wallet_address)
      setTokenSymbolArg(args.token_symbol) // This is the symbol requested by the user
    }

    if (tool.state === 'result' && tool.result) {
      try {
        const result = tool.result as WalletBalanceToolResult // Type assertion

        if (result.success) {
          setTokens(result.tokens)
          setErrorMessage(null)
          setIsFilteredView(result.filtered || false)
          // Use filter_symbol from result if present (tool confirmed specific filter),
          // otherwise, use the token_symbol from args if a filter was attempted.
          setDisplaySymbol(result.filter_symbol || tokenSymbolArg)
        } else {
          setTokens([])
          setErrorMessage(result.message || 'Failed to fetch wallet balances.')
          setIsFilteredView(false) // Reset filtered view on error
          setDisplaySymbol(tokenSymbolArg) // Still show what was attempted if error
        }
      } catch (error) {
        console.error('Error processing wallet balance result:', error)
        setTokens([])
        setErrorMessage('Error processing wallet balance data.')
        setIsFilteredView(false)
        setDisplaySymbol(tokenSymbolArg)
      }
    } else if (tool.state === 'call') {
      // Reset previous results when a new call is in progress
      setTokens(undefined)
      setErrorMessage(null)
    }
  }, [tool, tokenSymbolArg]) // tokenSymbolArg dependency ensures displaySymbol updates if args change

  // Determine loading state based on tool.state
  const isLoading = tool.state === 'call'

  // Do not render if there's no result yet, unless it's loading or has an error to display
  if (tool.state !== 'result' && tool.state !== 'call') {
    return null
  }

  // Custom title based on query type (all tokens or specific token)
  const title =
    isFilteredView && displaySymbol
      ? `${displaySymbol} Balance`
      : 'Wallet Balance'

  return (
    <CollapsibleMessage
    role="assistant"
    isCollapsible={true}
    header={title}
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    showIcon={false} // Assuming we want an icon
  >
        <WalletBalance
          title={title} // Pass the determined title to WalletBalance
          walletAddress={walletAddressArg} // Pass the wallet address from args for display
          tokens={tokens}
          isLoading={isLoading}
          error={errorMessage}
          className="mt-2 w-full shadow-sm"
        />
    </CollapsibleMessage>
  )
}

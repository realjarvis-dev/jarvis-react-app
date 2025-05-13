'use client'

import { ToolInvocation } from 'ai'
import { PendleOpportunitiesSection } from './pendle-opportunities-section'
import { QuestionConfirmation } from './question-confirmation'
import RetrieveSection from './retrieve-section'
import { SearchSection } from './search-section'
import { SimpleQuoteDisplay } from './simple-quote-display'
import { SwapTransactionCard } from './swap-transaction-card'
import { VideoSearchSection } from './video-search-section'
import { WalletBalanceSection } from './wallet-balance-section'
import { TransferSection } from './transfer-section'
interface ToolSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  addToolResult?: (params: { toolCallId: string; result: any }) => void
}

export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  addToolResult
}: ToolSectionProps) {
  // Special handling for ask_question tool
  if (tool.toolName === 'ask_question') {
    // When waiting for user input
    if (tool.state === 'call' && addToolResult) {
      return (
        <QuestionConfirmation
          toolInvocation={tool}
          onConfirm={(toolCallId, approved, response) => {
            addToolResult({
              toolCallId,
              result: approved
                ? response
                : {
                    declined: true,
                    skipped: response?.skipped,
                    message: 'User declined this question'
                  }
            })
          }}
        />
      )
    }

    // When result is available, display the result
    if (tool.state === 'result') {
      return (
        <QuestionConfirmation
          toolInvocation={tool}
          isCompleted={true}
          onConfirm={() => {}} // Not used in result display mode
        />
      )
    }
  }

  switch (tool.toolName) {
    case 'search':
      return (
        <SearchSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'videoSearch':
      return (
        <VideoSearchSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'retrieve':
      return (
        <RetrieveSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'pendle_opportunities':
      return (
        <PendleOpportunitiesSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'pendle_quote':
      return (
        <div className="flex flex-col space-y-4 py-4">
          <div className="flex flex-col">
            <h3 className="text-base font-medium">Pendle Quote</h3>
            <div className="mt-2">
              <SimpleQuoteDisplay tool={tool} isOpen={isOpen} onOpenChange={onOpenChange} />
            </div>
          </div>
        </div>
      )
    case 'pendle_swap':
      return (
        <div className="flex flex-col space-y-4 py-4">
          <div className="flex flex-col">
            <h3 className="text-base font-medium">Pendle Swap</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {tool.state === 'call' 
                ? 'Processing your swap transaction...' 
                : tool.state === 'result' && 'result' in tool && tool.result?.success 
                  ? 'Swap completed successfully' 
                  : 'Swap transaction failed'}
            </div>
            <div className="mt-2">
              <SwapTransactionCard tool={tool} isOpen={isOpen} onOpenChange={onOpenChange} />
            </div>
          </div>
        </div>
      )
    case 'wallet_balance':
      return (
        <WalletBalanceSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'privy_transfer':
      return (
        <TransferSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    default:
      return null
  }
}

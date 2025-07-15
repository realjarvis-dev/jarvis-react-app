'use client'

import { ToolInvocation } from 'ai'
import { GenericSwapCard } from './generic-swap-card'
import { GetGasPriceSection } from './get-gas-price-section'
import { KodiakBaultProfitability } from './kodiak-bault-profitability'
import { KodiakDepositCard } from './kodiak-deposit-card'
import { KodiakOpportunitiesSection } from './kodiak-opportunities-section'
import { LifiSwapExecuteSection } from './lifi-swap-execute-section'
import { LifiSwapQuoteSection } from './lifi-swap-quote-section'
import { MarketChartSection } from './market-chart-section'
import { PendleOpportunitiesSection } from './pendle-opportunities-section'
import { PendleZapInExecutionCard } from './pendle/pendle-zap-in-execution-card'
import { PendleZapInQuoteDisplay } from './pendle/pendle-zap-in-quote-display'
import { PendleZapOutExecutionCard } from './pendle/pendle-zap-out-execution-card'
import { PendleZapOutQuoteDisplay } from './pendle/pendle-zap-out-quote-display'
import { QuestionConfirmation } from './question-confirmation'
import { RedeemTransactionCard } from './redeem-transaction-card'
import RetrieveSection from './retrieve-section'
import { SearchSection } from './search-section'
import { SimpleQuoteDisplay } from './simple-quote-display'
import { SwapTransactionCard } from './swap-transaction-card'
import { TransferSection } from './transfer-section'
import { VideoSearchSection } from './video-search-section'
import { WalletBalanceSection } from './wallet-balance-section'
import { WalletFundingSection } from './wallet-funding-section'
import { DeFiLlamaYieldsSection } from './defillama-yields-section'
import { DeFiLlamaProtocolsSection } from './defillama-protocols-section'
import { XStockListSection } from './jupiter/xstock-list-section'
import { JupiterSwapQuoteSection } from './jupiter/swap-quote-section'
import { JupiterSwapExecuteSection } from './jupiter/swap-execute-section'

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
    case 'kodiak_opportunities':
      return (
        <KodiakOpportunitiesSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'kodiak_bault_profitability':
      return (
        <KodiakBaultProfitability
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'market_chart':
      return (
        <MarketChartSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'pendle_quote':
      return (
        <SimpleQuoteDisplay tool={tool} isOpen={isOpen} onOpenChange={onOpenChange} />
      )
    case 'pendle_mint_quote':
      return (
        <SimpleQuoteDisplay tool={tool} isOpen={isOpen} onOpenChange={onOpenChange} />
      )

    case 'pendle_mint':
    case 'pendle_mint_py':
    case 'pendle_mint_sy':
      return (
        <SwapTransactionCard
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'pendle_zap_in_quote':
      return (
        <PendleZapInQuoteDisplay
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'pendle_zap_out_quote':
      return (
        <PendleZapOutQuoteDisplay
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'pendle_zap_out_execute':
      return (
        <PendleZapOutExecutionCard
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'pendle_zap_in_execute':
      return (
        <PendleZapInExecutionCard
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )

    case 'pendle_redeem_quote':
      return (
        <SimpleQuoteDisplay tool={tool} isOpen={isOpen} onOpenChange={onOpenChange} />
      )

    case 'pendle_redeem':
    case 'pendle_redeem_pt':
    case 'pendle_redeem_yt':
      return <RedeemTransactionCard tool={tool} isOpen={isOpen} onOpenChange={onOpenChange} />

    case 'pendle_swap':
      return (
        <SwapTransactionCard tool={tool} isOpen={isOpen} onOpenChange={onOpenChange} />
      )

    case 'generic_swap':
      return (
        <GenericSwapCard
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'kodiak_deposit':
      return (
        <div className="flex flex-col space-y-4 py-4">
          <div className="flex flex-col">
            <h3 className="text-base font-medium">Kodiak Deposit</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {tool.state === 'call'
                ? 'Processing your deposit transaction...'
                : tool.state === 'result' &&
                  'result' in tool &&
                  tool.result?.success
                ? 'Deposit completed successfully'
                : 'Deposit transaction failed'}
            </div>
            <div className="mt-2">
              <KodiakDepositCard
                tool={tool}
                isOpen={isOpen}
                onOpenChange={onOpenChange}
              />
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
    case 'lifi_bridge_quote':
      return (
        <LifiSwapQuoteSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'lifi_bridge_execute':
      return (
        <LifiSwapExecuteSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'get_gas_price':
      return <GetGasPriceSection tool={tool} />
    case 'fund_wallet':
    case 'initial_wallet_reward':
      return (
        <WalletFundingSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'defillama_yields':
      return (
        <DeFiLlamaYieldsSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'defillama_protocols':
      return (
        <DeFiLlamaProtocolsSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'xstock_list':
      return (
        <XStockListSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'jupiter_quote':
      return (
        <JupiterSwapQuoteSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
    case 'jupiter_execute':
      return (
        <JupiterSwapExecuteSection
          tool={tool}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        />
      )
      case 'lifi_bridge_solana_quote':
        return (
          <LifiSwapQuoteSection
            tool={tool}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
          />
        )
      case 'lifi_bridge_solana_execute':
        return (
          <LifiSwapExecuteSection
            tool={tool}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
          />
        )
    default:
      return null
  }
}

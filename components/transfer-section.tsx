'use client'

import type { ToolInvocation } from 'ai'
import React from 'react' // Added React import for JSX
import { CollapsibleMessage } from './collapsible-message' // Assuming this can be reused
import { Section, ToolArgsSection } from './section' // Assuming this can be reused
import { MainnetConfig } from '@/lib/config/network'
interface TransferSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

interface PrivyTransferArgs {
  address: string
  amount: number
}

interface PrivyTransferResult {
  status: 'success' | 'fail'
  hash?: string
  error_message?: any
}

export function TransferSection({
  tool,
  isOpen,
  onOpenChange
}: TransferSectionProps) {
  const args = tool.args as PrivyTransferArgs

  const header = (
    <ToolArgsSection tool="transfer">{`Transfer to ${args.address} for ${args.amount} ETH`}</ToolArgsSection>
  )

  let statusDisplay: React.ReactNode = null // Changed to React.ReactNode

  switch (tool.state) {
    case 'call':
      statusDisplay = <p>Transaction in progress...</p>
      break
    case 'result':
      const toolResult = tool.result as PrivyTransferResult
      if (toolResult.status === 'success' || toolResult.hash) {
        statusDisplay = (
          <div>
            <p className="text-black-600">Transaction completed!</p>
            {toolResult.hash && (
              <p>
                View on {' '}
                <a
                  href={`https://${MainnetConfig.scanLink}/tx/${toolResult.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  EtherScan
                </a>
              </p>
            )}
          </div>
        )
      } else {
        // status === 'fail'
        statusDisplay = (
          <div>
            <p className="text-red-600">Transfer failed:</p>
            <pre className="whitespace-pre-wrap">
              {typeof toolResult.error_message === 'string'
                ? toolResult.error_message
                : JSON.stringify(toolResult.error_message, null, 2)}
            </pre>
          </div>
        )
      }
      break
    default:
      // Display the raw state if it's not 'call' or 'result'
      statusDisplay = <p>Status: {tool.state}</p>
      break
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false} // Assuming we want an icon
    >
      {statusDisplay && <Section title="Transaction">{statusDisplay}</Section>}
    </CollapsibleMessage>
  )
}

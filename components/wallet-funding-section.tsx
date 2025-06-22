'use client'

import React from 'react'
import { ToolInvocation } from 'ai'
import { useEffect, useState } from 'react'
import { CollapsibleMessage } from './collapsible-message'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Wallet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface WalletFundingToolResult {
  success: boolean
  message: string
  amount?: string
  wallet?: string
}

interface WalletFundingSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletFundingSection({
  tool,
  isOpen,
  onOpenChange
}: WalletFundingSectionProps) {
  const [walletAddressArg, setWalletAddressArg] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<WalletFundingToolResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (tool.args) {
      const args = tool.args as any
      setWalletAddressArg(args.wallet_address)
    }
  }, [tool.args])

  useEffect(() => {
    if (tool.state === 'result' && 'result' in tool && tool.result) {
      try {
        const toolResult = tool.result as any
        const fundingResult = toolResult.data || toolResult as WalletFundingToolResult

        if (fundingResult.success) {
          setResult(fundingResult)
          setErrorMessage(null)
        } else {
          setResult(null)
          setErrorMessage(fundingResult.message || 'Failed to fund wallet.')
        }
      } catch (error) {
        console.error('Error processing wallet funding result:', error)
        setResult(null)
        setErrorMessage('Error processing wallet funding data.')
      }
    }
  }, [tool.state, tool])

  const getStatusIcon = () => {
    if (tool.state === 'call') {
      return <Loader2 className="h-4 w-4 animate-spin" />
    } else if (result?.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else if (errorMessage) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    return <Wallet className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (tool.state === 'call') {
      return 'Funding wallet...'
    } else if (result?.success) {
      return 'Wallet funded successfully'
    } else if (errorMessage) {
      return 'Funding failed'
    }
    return 'Wallet funding'
  }

  const getStatusBadge = () => {
    if (tool.state === 'call') {
      return <Badge variant="secondary">Processing</Badge>
    } else if (result?.success) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
    } else if (errorMessage) {
      return <Badge variant="destructive">Failed</Badge>
    }
    return <Badge variant="outline">Ready</Badge>
  }

  const title = 'Demo Wallet Funding'

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      header={
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span>{getStatusText()}</span>
          {getStatusBadge()}
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            Fund your demo wallet with ETH for testing DeFi operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletAddressArg && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Wallet Address:</div>
              <div className="text-sm font-mono bg-muted p-2 rounded break-all">
                {walletAddressArg}
              </div>
            </div>
          )}

          {tool.state === 'call' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing funding request...
            </div>
          )}

          {result?.success && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Wallet funded successfully!
              </div>
              {result.amount && (
                <div className="text-sm">
                  <span className="font-medium">Amount funded:</span> {result.amount}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Your wallet now has sufficient balance for DeFi operations.
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                Funding failed
              </div>
              <div className="text-sm text-muted-foreground">
                {errorMessage}
              </div>
              <div className="text-sm text-muted-foreground">
                Note: Wallet funding is only available in Demo mode.
              </div>
            </div>
          )}

          {!result && !errorMessage && tool.state !== 'call' && (
            <div className="text-sm text-muted-foreground">
              This tool allows you to fund your wallet with ETH in Demo mode. 
              Use this when you need funds for DeFi transactions.
            </div>
          )}
        </CardContent>
      </Card>
    </CollapsibleMessage>
  )
}

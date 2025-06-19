'use client'

import { RedeemTransactionStatus } from '@/components/redeem-transaction-status'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getConfigByChainId } from '@/lib/network/config'
import { useNetwork } from '@/lib/network/context'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Clock, Link, Loader2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface RedeemTransactionCardProps {
  tool: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type TransactionStatus = 'preparing' | 'building' | 'signing' | 'broadcasting' | 'confirming' | 'confirmed' | 'failed'

export function RedeemTransactionCard({
  tool,
  isOpen,
  onOpenChange
}: RedeemTransactionCardProps) {
  console.log('==== RedeemTransactionCard RENDERED ====');
  console.log('Tool:', JSON.stringify({
    tool: tool.tool,
    toolName: tool.toolName,
    state: tool.state,
    args: tool.args,
    resultPreview: tool.result ? '[HAS RESULT]' : '[NO RESULT]'
  }, null, 2));
  
  const [status, setStatus] = useState<TransactionStatus>('preparing')
  const [tokenName, setTokenName] = useState<string>('PT/YT Token')
  const { isDemoMode } = useNetwork()
  
  // Parse the result
  const toolResult = tool.result
    ? typeof tool.result === 'string'
      ? JSON.parse(tool.result)
      : tool.result
    : null
  const result = toolResult?.data || toolResult

  // Determine if this is a YT rewards redemption or a PT redemption
  const isYtRewards = tool.toolName === 'pendle_redeem_yt'
  const isPtRedemption = tool.toolName === 'pendle_redeem_pt'
  const isUnifiedRedeem = tool.toolName === 'pendle_redeem'

  // Attempt to determine token name from the args or results
  useEffect(() => {
    // First try to get token name from result data (most reliable)
    if (result?.redeem_details?.token) {
      setTokenName(result.redeem_details.token)
      return
    }

    // If no result yet, fall back to args
    if (tool.args) {
      // Use provided display name if available
      if (tool.args.token_name_display) {
        setTokenName(tool.args.token_name_display)
        return
      }

      // For YT redemption, use generic "YT Rewards" if no specific token name
      if (isYtRewards) {
        setTokenName('YT Rewards')
        return
      }

      // For PT redemption, try to extract from address if no display name
      if (isPtRedemption && tool.args.pt_address) {
        // First try a generic address format if no pattern match
        const shortAddress = `${tool.args.pt_address.slice(0, 6)}...${tool.args.pt_address.slice(-4)}`
        setTokenName(`PT Token (${shortAddress})`)
      }
    }
  }, [tool.args, result, isYtRewards, isPtRedemption])

  // Simulate transaction flow for better UX
  useEffect(() => {
    if (tool.state === 'call') {
      // Set up the sequence of status changes for a better UX
      const statusSequence: Array<{ status: TransactionStatus; delay: number }> = [
        { status: 'preparing', delay: 1000 },
        { status: 'building', delay: 2000 },
        { status: 'signing', delay: 2000 },
        { status: 'broadcasting', delay: 1500 },
        { status: 'confirming', delay: 2500 }
      ]

      let timeoutId: NodeJS.Timeout | null = null
      let currentIndex = 0

      const advanceStatus = () => {
        if (currentIndex < statusSequence.length) {
          const { status, delay } = statusSequence[currentIndex]
          setStatus(status)
          currentIndex++
          timeoutId = setTimeout(advanceStatus, delay)
        }
      }

      // Start the sequence
      advanceStatus()

      // Cleanup function
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    } else if (tool.state === 'result' && result) {
      setStatus(result.success ? 'confirmed' : 'failed')
    }
  }, [tool.state, result])

  // Get appropriate icon and text for current status
  const getStatusInfo = (status: TransactionStatus) => {
    switch (status) {
      case 'preparing':
        return { 
          icon: <Clock className="h-4 w-4" />, 
          text: 'Preparing transaction', 
          color: 'text-blue-600 dark:text-blue-400' 
        }
      case 'building':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Building transaction', 
          color: 'text-blue-600 dark:text-blue-400' 
        }
      case 'signing':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Signing transaction', 
          color: 'text-amber-600 dark:text-amber-400' 
        }
      case 'broadcasting':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Broadcasting to network', 
          color: 'text-amber-600 dark:text-amber-400' 
        }
      case 'confirming':
        return { 
          icon: <Loader2 className="h-4 w-4 animate-spin" />, 
          text: 'Waiting for confirmation', 
          color: 'text-amber-600 dark:text-amber-400' 
        }
      case 'confirmed':
        return { 
          icon: <CheckCircle className="h-4 w-4" />, 
          text: 'Transaction confirmed', 
          color: 'text-green-600 dark:text-green-400' 
        }
      case 'failed':
        return { 
          icon: <AlertCircle className="h-4 w-4" />, 
          text: 'Transaction failed', 
          color: 'text-red-600 dark:text-red-400' 
        }
      default:
        return { 
          icon: <Clock className="h-4 w-4" />, 
          text: 'Processing', 
          color: 'text-gray-600 dark:text-gray-400' 
        }
    }
  }

  // Get status badge based on current status
  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'preparing':
      case 'building':
      case 'signing':
      case 'broadcasting':
      case 'confirming':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        )
      case 'confirmed':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
    }
  }

  // Progress steps for transaction flow
  const steps = [
    { id: 'preparing', label: 'Preparing' },
    { id: 'building', label: 'Building' },
    { id: 'signing', label: 'Signing' },
    { id: 'broadcasting', label: 'Broadcasting' },
    { id: 'confirming', label: 'Confirming' }
  ]

  // Get current status for display in child components
  const getCurrentStatus = () => status;
  
  // Get transaction hash when available
  const getTransactionHash = () => {
    if (result && result.success && result.transaction_hash) {
      return result.transaction_hash;
    }
    return undefined;
  };

  // Get chain ID from result or default to 1 (Ethereum)
  const getChainId = () => {
    if (result?.redeem_details?.chainId) {
      return result.redeem_details.chainId;
    }
    return 1; // Default to Ethereum
  };

  // Get a generic redemption title based on the token name and tool type
  const getRedemptionTitle = () => {
    if (isYtRewards) {
      return 'Yield Token Redemption'
    }
    
    if (isPtRedemption) {
      return 'Principal Token Redemption'
    }
    
    // Generic fallback
    return 'Token Redemption'
  }

  // Format token amounts for display
  const formatAmount = (amount: string | number) => {
    // Handle hex values (common for ETH amounts)
    if (typeof amount === 'string' && amount.startsWith('0x')) {
      try {
        // Convert hex to decimal and format as ETH
        return `${Number(BigInt(amount) / BigInt(10**15)) / 1000} ETH`;
      } catch (e) {
        // If conversion fails, return as is
        return amount;
      }
    }
    
    // Return as is for other formats
    return amount;
  };

  // If tool is in call state, show pending UI with steps
  if (tool.state === 'call') {
    const statusInfo = getStatusInfo(status)
    const currentStepIndex = steps.findIndex(step => step.id === status)
    
    return (
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">
                {getRedemptionTitle()}
              </h3>
              {getStatusBadge(status)}
            </div>
            
            {/* Progress steps */}
            <div className="relative">
              <div className="absolute left-0 top-1/2 w-full h-0.5 -translate-y-1/2 bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex justify-between relative">
                {steps.map((step, index) => {
                  const isActive = index <= currentStepIndex
                  const isCurrent = index === currentStepIndex
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center relative">
                      <div 
                        className={cn(
                          "w-3 h-3 rounded-full z-10",
                          isActive 
                            ? "bg-blue-600 dark:bg-blue-400" 
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      ></div>
                      <span 
                        className={cn(
                          "text-xs mt-2 text-center whitespace-nowrap",
                          isCurrent 
                            ? "font-medium text-blue-800 dark:text-blue-300" 
                            : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="pt-10">
              <RedeemTransactionStatus 
                status={status} 
                tokenName={tokenName}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If tool has a result, show completed/failed UI
  if (tool.state === 'result' && result) {
    const statusInfo = getStatusInfo(status)
    const etherscanBaseUrl = `https://${getConfigByChainId(getChainId(), isDemoMode).scanLink}`
    
    return (
      <Card className={cn(
        "border",
        status === 'confirmed' 
          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
          : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
      )}>
        <CardContent className="pt-4">
          <div className="flex flex-col space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-medium">
                {getRedemptionTitle()}
              </h3>
              {getStatusBadge(status)}
            </div>
            
            <RedeemTransactionStatus 
              status={status} 
              txHash={getTransactionHash()} 
              tokenName={tokenName}
              chainId={getChainId()}
            />
            
            {/* Transaction details */}
            {status === 'confirmed' && (
              <div className="bg-white dark:bg-black/20 rounded p-3 mt-2 text-sm">
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
                  <span>Transaction Hash:</span>
                  <a
                    href={`${etherscanBaseUrl}/tx/${getTransactionHash()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {getTransactionHash()?.slice(0, 6)}...{getTransactionHash()?.slice(-4)}
                    <Link className="h-3 w-3 ml-1" />
                  </a>
                </div>
                
                {!isYtRewards && result.redeem_details?.amount_in && (
                  <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
                    <span>Amount Redeemed:</span>
                    <span>{result.redeem_details.amount_in}</span>
                  </div>
                )}
                
                {!isYtRewards && result.redeem_details?.amount_out && (
                  <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>Amount Received:</span>
                    <span>
                      {formatAmount(result.redeem_details.amount_out)}
                    </span>
                  </div>
                )}
                
                {isYtRewards && result.redeem_details?.yts && (
                  <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>Tokens Redeemed:</span>
                    <span>{result.redeem_details.yts.length} token(s)</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 mt-1">
                  <span>Status:</span>
                  <span className={cn(
                    "font-medium",
                    status === 'confirmed' 
                      ? "text-green-600 dark:text-green-400" 
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {status === 'confirmed' ? 'Success' : 'Failed'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Error message if failed */}
            {status === 'failed' && result.error && (
              <div className="bg-red-100 dark:bg-red-900/20 rounded p-3 text-sm text-red-800 dark:text-red-300">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 mr-1 mt-0.5" />
                  <div>{result.error}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default return if neither call nor result (should not happen)
  return null
} 
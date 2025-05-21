'use client'

import { ToolInvocation } from 'ai'
import { useEffect, useState } from 'react'
import { WalletBalance } from './wallet-balance'

interface WalletBalanceSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletBalanceSection({
  tool,
  isOpen,
  onOpenChange
}: WalletBalanceSectionProps) {
  const [walletAddress, setWalletAddress] = useState<string | undefined>(undefined)
  const [tokenSymbol, setTokenSymbol] = useState<string | undefined>(undefined)
  const [isFiltered, setIsFiltered] = useState(false)
  
  useEffect(() => {
    if (tool.state === 'result' && tool.result) {
      try {
        const result = typeof tool.result === 'string' 
          ? JSON.parse(tool.result) 
          : tool.result
          
        // Get wallet address from the tool call arguments
        if (tool.args) {
          const args = typeof tool.args === 'string' 
            ? JSON.parse(tool.args) 
            : tool.args
            
          setWalletAddress(args.wallet_address)
          setTokenSymbol(args.token_symbol)
        }
        
        // Set whether this is a filtered view
        setIsFiltered(result.filtered || false)
      } catch (error) {
        console.error('Error parsing wallet balance result:', error)
      }
    }
  }, [tool])
  
  if (tool.state !== 'result' || !tool.result) {
    return null
  }
  
  // Custom title based on query type (all tokens or specific token)
  const title = isFiltered && tokenSymbol
    ? `${tokenSymbol} Balance`
    : 'Wallet Balance'
  
  return (
    <div className="flex flex-col space-y-4 py-4">
      <div className="flex flex-col">
        <h3 className="text-base font-medium">{title}</h3>
        <WalletBalance 
          walletAddress={walletAddress}
          tokenSymbol={tokenSymbol}
          className="mt-2 w-full shadow-sm"
        />
      </div>
    </div>
  )
}
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenData } from '@/lib/alchemy/types'
import { useNetwork } from '@/lib/context/network-context'
import { useState } from 'react'

const TokenRow = ({ token }: { token: TokenData }) => {
  // Format balance to a nice readable format (e.g., 9979.99 ETH)
  const balanceValue = parseFloat(token.balance)
  const formattedBalance =
    balanceValue >= 0.01 ? balanceValue.toFixed(2) : balanceValue.toPrecision(4)

  return (
    <div className="flex items-center justify-between py-3 px-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
          {token.symbol.substring(0, 2)}
        </div>
        <div>
          <p className="font-medium">{token.symbol}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {token.name}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-lg">{formattedBalance}</p>
      </div>
    </div>
  )
}

const NetworkSection = ({ network, tokens, isExpanded }: { 
  network: string
  tokens: TokenData[]
  isExpanded: boolean 
}) => {
  const displayTokens = isExpanded ? tokens : tokens.slice(0, 2)
  
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
          {network}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {tokens.length} {tokens.length === 1 ? 'token' : 'tokens'}
        </Badge>
      </div>
      <div className="space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
        {displayTokens.map(token => (
          <TokenRow
            key={`${token.address}-${token.network}`}
            token={token}
          />
        ))}
        {!isExpanded && tokens.length > 2 && (
          <div className="py-2 px-3 text-sm text-gray-500 dark:text-gray-400">
            +{tokens.length - 2} more tokens...
          </div>
        )}
      </div>
    </div>
  )
}

interface WalletBalanceProps {
  title: string
  walletAddress?: string
  tokens?: TokenData[]
  isLoading: boolean
  error?: string | null
  className?: string
}

export function WalletBalance({
  title,
  walletAddress,
  tokens,
  isLoading,
  error,
  className = ''
}: WalletBalanceProps) {
  const [expanded, setExpanded] = useState(false)
  const { activeNetwork, selectedChain, isDemoMode } = useNetwork()

  const tokensList = tokens || []

  // Helper function to determine if a token belongs to the selected network
  const matchesSelectedNetwork = (tokenNetwork: string) => {
    // Normalize the token network name for comparison
    const normalizedTokenNetwork = tokenNetwork.toLowerCase()
    
    // Handle demo mode specially - only show Tenderly tokens in demo mode
    if (isDemoMode) {
      return normalizedTokenNetwork.includes('tenderly') || 
             normalizedTokenNetwork.includes('demo')
    }
    
    // For non-demo mode, match based on the selected chain
    switch (selectedChain) {
      case 'ethereum':
        return normalizedTokenNetwork.includes('eth_mainnet') || 
               normalizedTokenNetwork.includes('ethereum') ||
               normalizedTokenNetwork === 'eth-mainnet'
      case 'sepolia':
        return normalizedTokenNetwork.includes('eth_sepolia') || 
               normalizedTokenNetwork.includes('sepolia') ||
               normalizedTokenNetwork === 'eth-sepolia'
      case 'berachain':
        // Include both mainnet and testnet tokens for berachain
        return normalizedTokenNetwork.includes('berachain') || 
               normalizedTokenNetwork.includes('bera')
      default:
        return false
    }
  }

  // Filter tokens based on the selected network using our improved matching
  const filteredTokens = tokensList.filter(token => matchesSelectedNetwork(token.network))
  
  // Group tokens by network (we'll only have one network after filtering)
  const tokensByNetwork = filteredTokens.reduce((acc, token) => {
    if (!acc[token.network]) {
      acc[token.network] = []
    }
    acc[token.network].push(token)
    return acc
  }, {} as Record<string, TokenData[]>)

  // Sort networks to show mainnet first, then others alphabetically
  const sortedNetworks = Object.keys(tokensByNetwork).sort((a, b) => {
    if (a.toLowerCase().includes('mainnet') && !b.toLowerCase().includes('mainnet')) return -1
    if (!a.toLowerCase().includes('mainnet') && b.toLowerCase().includes('mainnet')) return 1
    return a.localeCompare(b)
  })

  const totalTokenCount = filteredTokens.length
  const hasMultipleNetworks = sortedNetworks.length > 1

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className} shadow-md`}>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-2">
            {hasMultipleNetworks && (
              <Badge variant="outline" className="text-sm font-normal">
                {sortedNetworks.length} {sortedNetworks.length === 1 ? 'Network' : 'Networks'}
              </Badge>
            )}
            <Badge variant="outline" className="text-sm font-normal">
              {totalTokenCount} {totalTokenCount === 1 ? 'Token' : 'Tokens'}
            </Badge>
          </div>
        </div>
        <CardDescription>
          {walletAddress
            ? `Wallet: ${walletAddress}`
            : 'Your cryptocurrency holdings'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="space-y-6">
            {[1, 2].map(networkIndex => (
              <div key={networkIndex} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                  {[1, 2].map(tokenIndex => (
                    <div
                      key={tokenIndex}
                      className="flex items-center space-x-3 py-3 px-3 rounded-lg border border-gray-100 dark:border-gray-800"
                    >
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-3 w-[80px]" />
                      </div>
                      <div className="ml-auto">
                        <Skeleton className="h-5 w-[60px]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="py-8 text-center">
            <p className="text-red-500 mb-2">{error}</p>
          </div>
        )}

        {!isLoading && !error && filteredTokens.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-500 mb-2">
              {'No tokens found for the selected network'}
            </p>
          </div>
        )}

        {!isLoading && !error && sortedNetworks.length > 0 && (
          <div>
            {sortedNetworks.map(network => (
              <NetworkSection
                key={network}
                network={network}
                tokens={tokensByNetwork[network]}
                isExpanded={expanded}
              />
            ))}
          </div>
        )}
      </CardContent>

      {totalTokenCount > 4 && (
        <CardFooter className="flex justify-center border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : 'Show All Tokens'}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

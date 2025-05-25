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
import { useState } from 'react'

const TokenRow = ({ token }: { token: TokenData }) => {
  // Format balance to a nice readable format (e.g., 9979.99 ETH)
  const balanceValue = parseFloat(token.balance)
  const formattedBalance =
    balanceValue >= 0.01 ? balanceValue.toFixed(2) : balanceValue.toPrecision(4)

  return (
    <div className="flex items-center justify-between py-4 px-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors mb-3">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
          {token.symbol.substring(0, 2)}
        </div>
        <div>
          <p className="font-medium">{token.symbol}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {token.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {token.network}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-lg">{formattedBalance}</p>
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

  const tokensList = tokens || []

  const displayTokens = expanded ? tokensList : tokensList.slice(0, 3)

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className} shadow-md`}>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline" className="text-sm font-normal">
            {tokensList.length} {tokensList.length === 1 ? 'Token' : 'Tokens'}
          </Badge>
        </div>
        <CardDescription>
          {walletAddress
            ? `Wallet: ${walletAddress}`
            : 'Your cryptocurrency holdings'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex items-center space-x-3 py-4 px-3 rounded-lg border border-gray-100 dark:border-gray-800 mb-3"
              >
                <Skeleton className="w-10 h-10 rounded-full" />
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
        )}

        {error && (
          <div className="py-8 text-center">
            <p className="text-red-500 mb-2">{error}</p>
          </div>
        )}

        {!isLoading && !error && tokensList.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-500 mb-2">
              {'No tokens found in this wallet'}
            </p>
          </div>
        )}

        {!isLoading && !error && displayTokens.length > 0 && (
          <div>
            {displayTokens.map(token => (
              <TokenRow
                key={`${token.address}-${token.network}`}
                token={token}
              />
            ))}
          </div>
        )}
      </CardContent>

      {tokensList.length > 3 && (
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

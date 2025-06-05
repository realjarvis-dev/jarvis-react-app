'use client'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenData } from '@/lib/alchemy/types'
import { allNetworkConfigs } from '@/lib/network/config'
import { useNetwork } from '@/lib/network/context'

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

const NetworkSection = ({
  network,
  tokens
}: {
  network: string
  tokens: TokenData[]
}) => {
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
        {tokens.map(token => (
          <TokenRow key={`${token.address}-${token.network}`} token={token} />
        ))}
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
  const { activeNetwork, selectedChain, isDemoMode } = useNetwork()

  const tokensList = tokens || []

  // Helper function to determine if a token belongs to the selected network
  const matchesSelectedNetwork = (tokenNetwork: string) => {
    // tokenNetwork is assumed to be the alchemyNetwork string, e.g., 'eth-mainnet'
    if (isDemoMode) {
      // In demo mode, TENDERLY_DEMO_CONFIG defines the active network.
      // Its alchemyNetwork might be, for example, Network.ETH_MAINNET ('eth-mainnet')
      return tokenNetwork === 'Ethereum (Demo)'
    }

    // For non-demo mode, match based on the selected chain's alchemyNetwork
    // selectedChain is a ChainType, e.g., 'ethereum'
    const currentNetworkConfig = allNetworkConfigs[selectedChain]
    if (currentNetworkConfig) {
      return tokenNetwork === currentNetworkConfig.displayName
    }
    return false // Should not happen if selectedChain is a valid ChainType
  }

  // Filter tokens based on the selected network using our improved matching
  const filteredTokens = tokensList.filter(token =>
    matchesSelectedNetwork(token.network)
  )

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
    if (
      a.toLowerCase().includes('mainnet') &&
      !b.toLowerCase().includes('mainnet')
    )
      return -1
    if (
      !a.toLowerCase().includes('mainnet') &&
      b.toLowerCase().includes('mainnet')
    )
      return 1
    return a.localeCompare(b)
  })

  const totalTokenCount = filteredTokens.length
  const hasMultipleNetworks = sortedNetworks.length > 1
  console.log('sortedNetworks', sortedNetworks)
  console.log('tokensByNetwork', tokensByNetwork)
  console.log('filteredTokens', filteredTokens)
  console.log('tokensList', tokensList)
  return (
    <Card className={`w-full max-w-2xl mx-auto ${className} shadow-md`}>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-2">
            {hasMultipleNetworks && (
              <Badge variant="outline" className="text-sm font-normal">
                {sortedNetworks.length}{' '}
                {sortedNetworks.length === 1 ? 'Network' : 'Networks'}
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
            {sortedNetworks.map(networkAlchemyName => (
              <NetworkSection
                key={networkAlchemyName}
                network={activeNetwork.displayName}
                tokens={tokensByNetwork[networkAlchemyName]}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

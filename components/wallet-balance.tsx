'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenData } from '@/lib/types/wallet-token'
import { allNetworkConfigs } from '@/lib/network/config'
import { useNetwork } from '@/lib/network/context'
import { cn } from '@/lib/utils'
import { CopyableWalletAddress } from './copyable-wallet-address'

const TokenRow = ({ token }: { token: TokenData }) => {
  // Format balance to a nice readable format (e.g., 9,979.99 ETH)
  const balanceValue = parseFloat(token.balance)
  const formattedBalance =
    balanceValue >= 0.01
      ? balanceValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      : balanceValue.toPrecision(4)

  return (
    <div className="flex items-center justify-between p-3 rounded-xl transition-colors hover:bg-muted/40">
      <div className="flex items-center space-x-4">
        <div className="relative w-10 h-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white shadow">
            {token.symbol.substring(0, 2)}
          </div>
        </div>
        <div>
          <p className="font-semibold text-foreground">{token.symbol}</p>
          <p className="text-sm text-muted-foreground">{token.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-base tabular-nums tracking-tight">
          {formattedBalance}
        </p>
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
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="text-base font-semibold text-muted-foreground">
          {network}
        </h3>
        <Badge variant="outline" className="text-xs font-normal">
          {tokens.length} {tokens.length === 1 ? 'token' : 'tokens'}
        </Badge>
      </div>
      <div className="space-y-1">
        {tokens.map(token => (
          <TokenRow key={`${token.address}-${token.network}-${token.name}`} token={token} />
        ))}
      </div>
    </div>
  )
}

interface WalletBalanceProps {
  title: string
  walletAddress?: string
  solanaWalletAddress?: string
  tokens?: TokenData[]
  isLoading: boolean
  error?: string | null
  className?: string
  filterOnNetwork?: boolean
}

export function WalletBalance({
  title,
  walletAddress,
  solanaWalletAddress,
  tokens,
  isLoading,
  error,
  className = '',
  filterOnNetwork = true
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
  const filteredTokens = filterOnNetwork
    ? tokensList.filter(token => matchesSelectedNetwork(token.network))
    : tokensList

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
    if (a.toLowerCase().includes('mainnet')) return -1
    return a.localeCompare(b)
  })

  const totalTokenCount = filteredTokens.length
  const hasMultipleNetworks = sortedNetworks.length > 1
  let walletAddressToDisplay = walletAddress
  if (activeNetwork.id === "solana") {
    walletAddressToDisplay = solanaWalletAddress
  }
  return (
    <Card
      className={cn(
        'w-full  mx-auto flex flex-col max-h-[70vh] rounded-2xl border border-black/5 dark:border-white/10 bg-white/5 dark:bg-black/20 backdrop-blur-xl',
        className
      )}
    >
      <CardHeader className="border-b pb-4">
        <div className="flex w-full ">
          {walletAddressToDisplay ? (
            <CopyableWalletAddress
              walletAddress={walletAddressToDisplay}
              walletAddressIntroText=""
            />
          ) : (
            <div />
          )}
          <div className="ml-auto flex items-center gap-2">
            {hasMultipleNetworks && (
              <Badge variant="outline" className="text-sm font-normal">
                {sortedNetworks.length}{' '}
                {sortedNetworks.length === 1 ? 'Network' : 'Networks'}
              </Badge>
            )}
            {hasMultipleNetworks && (
            <Badge variant="outline" className="text-sm font-normal">
              {totalTokenCount} {totalTokenCount === 1 ? 'Token' : 'Tokens'}
            </Badge>)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-y-auto pt-6">
        {isLoading && (
          <div className="space-y-6">
            {[1, 2].map(networkIndex => (
              <div key={networkIndex} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between mb-3 px-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="space-y-1">
                  {[1, 2, 3].map(tokenIndex => (
                    <div
                      key={tokenIndex}
                      className="flex items-center justify-between rounded-xl p-3"
                    >
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-5 w-16" />
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
          <div className="pt-2">
            {sortedNetworks.map(networkAlchemyName => (
              <NetworkSection
                key={networkAlchemyName}
                network={networkAlchemyName}
                tokens={tokensByNetwork[networkAlchemyName]}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

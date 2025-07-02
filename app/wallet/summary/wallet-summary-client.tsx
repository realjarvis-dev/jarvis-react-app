'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePrivy } from '@privy-io/react-auth'
import { Activity, AlertCircle, Brain, CheckCircle, DollarSign, Loader2, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface WalletSummaryData {
  indexed: boolean
  walletAddress?: string
  message: string
  analysis?: {
    riskProfile: string
    confidence: number
    reasoning: string
    topProtocols: string[]
    primaryAssets: string[]
    activityPattern: string
    tradingFrequency: string
    averageTransactionSize: {
      eth: number
      usd_estimate: number
    }
  }
  quickSummary?: string
  suggestion?: string
}

export default function WalletSummaryClient() {
  const { authenticated, ready } = usePrivy()
  const [summaryData, setSummaryData] = useState<WalletSummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isIndexing, setIsIndexing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWalletSummary = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/wallet/summary', {
        method: 'GET',
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch wallet summary')
      }
      
      setSummaryData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching wallet summary:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleIndexWallet = async () => {
    setIsIndexing(true)
    
    try {
      toast.info('Starting wallet analysis...', {
        description: 'This may take a few moments to complete',
        duration: 3000
      })

      const response = await fetch('/api/wallet/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxPages: 3,
          maxConcurrency: 2,
          analysisModel: 'openai:gpt-4o-mini'
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Wallet indexed successfully!', {
          description: `Analyzed ${result.summary.totalTransactions} transactions. Risk profile: ${result.summary.riskProfile}`,
          duration: 5000
        })
        
        // Refresh the summary data
        await fetchWalletSummary()
      } else {
        toast.error('Wallet indexing failed', {
          description: result.error || 'Unknown error occurred',
          duration: 4000
        })
      }
    } catch (error) {
      toast.error('Network error', {
        description: 'Failed to connect to indexing service',
        duration: 4000
      })
      console.error('Error indexing wallet:', error)
    } finally {
      setIsIndexing(false)
    }
  }

  useEffect(() => {
    if (ready && authenticated) {
      fetchWalletSummary()
    }
  }, [ready, authenticated])

  if (!ready) {
    return <WalletSummarySkeleton />
  }

  if (!authenticated) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            Authentication Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Please sign in to view your wallet intelligence summary.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <WalletSummarySkeleton />
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-6 w-6" />
            Error Loading Wallet Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchWalletSummary} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!summaryData?.indexed) {
    return (
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-500" />
            Wallet Not Indexed
          </CardTitle>
          <CardDescription>
            {summaryData?.walletAddress && (
              <span className="font-mono text-xs break-all">
                {summaryData.walletAddress}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            {summaryData?.message || 'Your wallet needs to be analyzed to generate insights.'}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {summaryData?.suggestion || 'Click the button below to start analyzing your transaction history with AI.'}
          </p>
          <Button 
            onClick={handleIndexWallet} 
            disabled={isIndexing}
            className="w-full sm:w-auto"
          >
            {isIndexing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Wallet...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Index My Wallet
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { analysis, quickSummary, walletAddress } = summaryData

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Wallet Intelligence Summary
          </CardTitle>
          <CardDescription>
            <span className="font-mono text-xs break-all">{walletAddress}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-lg">{quickSummary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={fetchWalletSummary} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleIndexWallet} variant="outline" size="sm" disabled={isIndexing}>
              {isIndexing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Re-analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Risk Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Risk Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant={
                analysis?.riskProfile === 'Conservative' ? 'secondary' :
                analysis?.riskProfile === 'Moderate' ? 'default' : 'destructive'
              } className="text-sm">
                {analysis?.riskProfile}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Confidence: {analysis?.confidence}%
              </p>
              <p className="text-sm">{analysis?.reasoning}</p>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Patterns */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Trading Frequency</p>
                <Badge variant="outline">{analysis?.tradingFrequency}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Activity Pattern</p>
                <p className="text-sm text-muted-foreground">{analysis?.activityPattern}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Transaction Size */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Transaction Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-2xl font-bold">{analysis?.averageTransactionSize?.eth?.toFixed(4)} ETH</p>
                <p className="text-sm text-muted-foreground">
                  ~${analysis?.averageTransactionSize?.usd_estimate?.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Protocols */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Protocols
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis?.topProtocols && analysis.topProtocols.length > 0 ? (
                analysis.topProtocols.map((protocol, index) => (
                  <Badge key={index} variant="outline" className="mr-2 mb-2">
                    {protocol}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No protocols identified</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Primary Assets */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Primary Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysis?.primaryAssets && analysis.primaryAssets.length > 0 ? (
                analysis.primaryAssets.map((asset, index) => (
                  <Badge key={index} variant="outline" className="mb-2">
                    {asset}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No primary assets identified</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function WalletSummarySkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 
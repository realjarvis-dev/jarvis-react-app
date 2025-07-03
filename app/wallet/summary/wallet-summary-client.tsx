'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { usePrivy } from '@privy-io/react-auth'
import { Activity, AlertCircle, BarChart3, Brain, CheckCircle, ChevronDown, ChevronUp, Coins, DollarSign, Loader2, Shield, TrendingUp, Users, Zap } from 'lucide-react'
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
  const [additionalWallet, setAdditionalWallet] = useState<string>('')
  const [showAdditionalWallet, setShowAdditionalWallet] = useState(false)

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
      
      // If wallet is indexed, fetch the additional wallet address from the last indexing
      if (data.indexed) {
        try {
          const additionalWalletResponse = await fetch('/api/wallet/additional-wallet', {
            method: 'GET',
            credentials: 'include'
          })
          if (additionalWalletResponse.ok) {
            const additionalWalletData = await additionalWalletResponse.json()
            if (additionalWalletData.additionalWallet) {
              setAdditionalWallet(additionalWalletData.additionalWallet)
            }
          }
        } catch (err) {
          // Ignore errors for additional wallet fetching
          console.log('No additional wallet found or error fetching:', err)
        }
      }
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

      const requestBody: {
        maxPages: number;
        maxConcurrency: number;
        analysisModel: string;
        additionalWallet?: string;
      } = {
        maxPages: 3,
        maxConcurrency: 2,
        analysisModel: 'openai:gpt-4o-mini'
      }

      // Add additional wallet if provided
      if (additionalWallet.trim()) {
        requestBody.additionalWallet = additionalWallet.trim()
      }

      const response = await fetch('/api/wallet/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
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
          
          {/* Additional Wallet Section */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdditionalWallet(!showAdditionalWallet)}
                className="p-0 h-auto text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {showAdditionalWallet ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide additional wallet
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Add additional wallet (optional)
                  </>
                )}
              </Button>
            </div>
            
            {showAdditionalWallet && (
              <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <Label htmlFor="additional-wallet" className="text-sm font-medium">
                  Additional Wallet Address
                </Label>
                <Input
                  id="additional-wallet"
                  type="text"
                  placeholder="0x... (optional)"
                  value={additionalWallet}
                  onChange={(e) => setAdditionalWallet(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Optionally provide another wallet address to analyze together with your Jarvis wallet.
                </p>
              </div>
            )}
          </div>
          
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

  // Helper function to get risk profile styling
  const getRiskProfileStyle = (riskProfile: string) => {
    switch (riskProfile?.toLowerCase()) {
      case 'conservative':
        return {
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400',
          gradient: 'from-emerald-500/10 to-green-500/5',
          icon: Shield,
          color: 'text-emerald-600 dark:text-emerald-400'
        }
      case 'moderate':
        return {
          badge: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400',
          gradient: 'from-blue-500/10 to-cyan-500/5',
          icon: BarChart3,
          color: 'text-blue-600 dark:text-blue-400'
        }
      case 'aggressive':
        return {
          badge: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400',
          gradient: 'from-orange-500/10 to-red-500/5',
          icon: TrendingUp,
          color: 'text-orange-600 dark:text-orange-400'
        }
      case 'degen':
        return {
          badge: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-400',
          gradient: 'from-red-500/10 to-pink-500/5',
          icon: Zap,
          color: 'text-red-600 dark:text-red-400'
        }
      default:
        return {
          badge: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/20 dark:text-gray-400',
          gradient: 'from-gray-500/10 to-slate-500/5',
          icon: BarChart3,
          color: 'text-gray-600 dark:text-gray-400'
        }
    }
  }

  const riskStyle = getRiskProfileStyle(analysis?.riskProfile || '')
  const RiskIcon = riskStyle.icon

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Enhanced Header Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Wallet Intelligence Summary
                </span>
              </div>
            </CardTitle>
            <CardDescription className="text-base">
              <span className="font-mono text-sm px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg border break-all">
                {walletAddress}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
              <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">{quickSummary}</p>
            </div>
            
            {/* Additional Wallet Section for Re-indexing */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdditionalWallet(!showAdditionalWallet)}
                  className="p-0 h-auto text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  {showAdditionalWallet ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide additional wallet
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      {additionalWallet ? 'Update additional wallet' : 'Add additional wallet (optional)'}
                    </>
                  )}
                </Button>
                {additionalWallet && !showAdditionalWallet && (
                  <span className="text-xs text-muted-foreground font-mono">
                    Currently: {additionalWallet.slice(0, 6)}...{additionalWallet.slice(-4)}
                  </span>
                )}
              </div>
              
              {showAdditionalWallet && (
                <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                  <Label htmlFor="additional-wallet-reindex" className="text-sm font-medium">
                    Additional Wallet Address
                  </Label>
                  <Input
                    id="additional-wallet-reindex"
                    type="text"
                    placeholder="0x... (optional)"
                    value={additionalWallet}
                    onChange={(e) => setAdditionalWallet(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionally provide another wallet address to analyze together with your Jarvis wallet.
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={handleIndexWallet} variant="outline" size="sm" disabled={isIndexing} className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20">
                {isIndexing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                Re-index Wallet
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Analysis Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Enhanced Risk Profile */}
          <Card className={`border-0 shadow-lg bg-gradient-to-br ${riskStyle.gradient} hover:shadow-xl transition-all duration-200`}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className={`p-2 rounded-full bg-white/80 dark:bg-gray-800/80 ${riskStyle.color}`}>
                  <RiskIcon className="h-5 w-5" />
                </div>
                Risk Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={`text-sm font-semibold px-3 py-1 ${riskStyle.badge}`}>
                  {analysis?.riskProfile}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Confidence</span>
                  <span className="text-sm font-bold">{analysis?.confidence}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-2 rounded-full ${
                      riskStyle.color.includes('emerald') ? 'bg-emerald-500' :
                      riskStyle.color.includes('blue') ? 'bg-blue-500' :
                      riskStyle.color.includes('orange') ? 'bg-orange-500' :
                      riskStyle.color.includes('red') ? 'bg-red-500' : 'bg-gray-500'
                    }`} 
                    style={{ width: `${analysis?.confidence}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg">
                {analysis?.reasoning}
              </p>
            </CardContent>
          </Card>

          {/* Enhanced Activity Patterns */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/5 hover:shadow-xl transition-all duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80">
                  <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                Activity Patterns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Trading Frequency</span>
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-400">
                    {analysis?.tradingFrequency}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Activity Pattern</span>
                  <span className="text-sm font-semibold capitalize">{analysis?.activityPattern}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Transaction Size */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/5 hover:shadow-xl transition-all duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80">
                  <DollarSign className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                Transaction Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {analysis?.averageTransactionSize?.eth?.toFixed(4)} ETH
                </p>
                <p className="text-lg font-semibold text-gray-600 dark:text-gray-400 mt-1">
                  ~${analysis?.averageTransactionSize?.usd_estimate?.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Average per transaction</p>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Top Protocols */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/5 hover:shadow-xl transition-all duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Top Protocols
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis?.topProtocols && analysis.topProtocols.length > 0 ? (
                  analysis.topProtocols.map((protocol, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                          {index + 1}
                        </span>
                      </div>
                      <span className="font-medium">{protocol}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No protocols identified</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Primary Assets */}
          <Card className="md:col-span-2 border-0 shadow-lg bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/5 hover:shadow-xl transition-all duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/80 dark:bg-gray-800/80">
                  <Coins className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                Primary Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analysis?.primaryAssets && analysis.primaryAssets.length > 0 ? (
                  analysis.primaryAssets.map((asset, index) => (
                    <div key={index} className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-cyan-200/50 dark:border-cyan-800/50 min-h-[60px] flex items-center">
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <Coins className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild className="flex-1 min-w-0">
                            <span className="font-medium text-sm leading-tight truncate block cursor-help">{asset}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{asset}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-4">No primary assets identified</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}

function WalletSummarySkeleton() {
  return (
    <div className="space-y-8">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900/20">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-6 w-96 mt-2" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
            <Skeleton className="h-6 w-full mb-3" />
            <Skeleton className="h-6 w-3/4" />
          </div>
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-lg hover:shadow-xl transition-all duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-6 w-32" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
        {/* Last card spans 2 columns */}
        <Card className="md:col-span-2 border-0 shadow-lg hover:shadow-xl transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-6 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { ToolArgsSection } from './section'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { AlertTriangle, TrendingUp, Shield, Zap } from 'lucide-react'

interface PendlePtLoopingQuoteDisplayProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function PendlePtLoopingQuoteDisplay({
  tool,
  isOpen,
  onOpenChange
}: PendlePtLoopingQuoteDisplayProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  const toolResult = tool.result || {}
  const result = toolResult.data || toolResult || {}

  const header = (
    <ToolArgsSection tool="pendle_pt_looping_quote">
      PT Looping Opportunities
    </ToolArgsSection>
  )

  if (result.error) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="p-4 text-red-600 dark:text-red-400">
          <div className="font-medium mb-2">Error fetching PT looping opportunities</div>
          <div className="text-sm">{result.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  const opportunities = result.opportunities || []
  const scanningProgress = result.scanningProgress
  const diagnostics = result.diagnostics

  if (opportunities.length === 0) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="space-y-4 p-4">
          {/* Scanning Progress */}
          {scanningProgress && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                🔍 Market Scanning Complete
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                <div>✅ Scanned {scanningProgress.pendleMarketsFound} Pendle markets</div>
                <div>✅ Found {scanningProgress.eligiblePTTokens} eligible PT tokens</div>
                <div>✅ Checked {scanningProgress.morphoMarketsFound} Morpho lending markets</div>
                <div>❌ Found {scanningProgress.opportunitiesFound} viable looping opportunities</div>
              </div>
            </div>
          )}

          {/* Diagnostic Information */}
          {diagnostics && (
            <div className="space-y-3">
              <div className="font-medium text-gray-700 dark:text-gray-300">Market Analysis</div>
              
              {/* Sample PT Yields */}
              {diagnostics.sampleData?.topPTYields && diagnostics.sampleData.topPTYields.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm font-medium mb-2">Top PT Token Yields Found:</div>
                  <div className="space-y-1 text-xs">
                    {diagnostics.sampleData.topPTYields.map((pt: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{pt.name}</span>
                        <span className="font-mono">{pt.apy} ({pt.liquidity})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Borrow Rates */}
              {diagnostics.sampleData?.sampleBorrowRates && diagnostics.sampleData.sampleBorrowRates.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm font-medium mb-2">Sample Morpho Borrow Rates:</div>
                  <div className="space-y-1 text-xs">
                    {diagnostics.sampleData.sampleBorrowRates.map((rate: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{rate.asset}</span>
                        <span className="font-mono">{rate.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Criteria */}
              {diagnostics.searchCriteria && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm font-medium mb-2">Search Criteria Used:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Min Yield Spread: <span className="font-mono">{diagnostics.searchCriteria.minYieldSpread}</span></div>
                    <div>Max Leverage: <span className="font-mono">{diagnostics.searchCriteria.maxLeverage}</span></div>
                    <div>Risk Tolerance: <span className="font-mono">{diagnostics.searchCriteria.riskTolerance}</span></div>
                    <div>Network: <span className="font-mono">{diagnostics.searchCriteria.network}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {diagnostics?.suggestions && diagnostics.suggestions.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                💡 Suggestions to Find Opportunities:
              </div>
              <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
                {diagnostics.suggestions.map((suggestion: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
            Try adjusting your search criteria or check a different network to find opportunities.
          </div>
        </div>
      </CollapsibleMessage>
    )
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'HIGH': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatLiquidity = (liquidity: number) => {
    if (liquidity >= 1000000) {
      return `$${(liquidity / 1000000).toFixed(1)}M`
    } else if (liquidity >= 1000) {
      return `$${(liquidity / 1000).toFixed(1)}K`
    } else {
      return `$${liquidity.toFixed(0)}`
    }
  }

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return <Shield size={14} />
      case 'MEDIUM': return <TrendingUp size={14} />
      case 'HIGH': return <AlertTriangle size={14} />
      default: return <Zap size={14} />
    }
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <div className="space-y-4 p-4">
        {/* Scanning Progress Summary */}
        {scanningProgress && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
            <div className="font-medium text-green-700 dark:text-green-300 mb-2">
              🎯 Market Scan Results
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-green-600 dark:text-green-400">
              <div>
                <div className="font-medium">Pendle Markets</div>
                <div>{scanningProgress.pendleMarketsFound} scanned, {scanningProgress.eligiblePTTokens} eligible</div>
              </div>
              <div>
                <div className="font-medium">Morpho Markets</div>
                <div>{scanningProgress.morphoMarketsFound} checked, {scanningProgress.opportunitiesFound} opportunities</div>
              </div>
            </div>
            {diagnostics?.searchCriteria && (
              <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800 text-xs text-green-600 dark:text-green-400">
                Search: {diagnostics.searchCriteria.minYieldSpread} spread, {diagnostics.searchCriteria.maxLeverage} leverage, {diagnostics.searchCriteria.riskTolerance} risk on {diagnostics.searchCriteria.network}
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Found {opportunities.length} PT looping opportunities on {result.chainId === 1 ? 'Ethereum' : 'Base'}
        </div>

        <div className="grid gap-4">
          {opportunities.map((opportunity: any, index: number) => (
            <Card key={index} className="border border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">
                      {opportunity.ptToken}
                    </CardTitle>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Expires: {new Date(opportunity.ptExpiry).toLocaleDateString()} ({opportunity.daysToExpiry} days)
                    </div>
                  </div>
                  <Badge className={getRiskColor(opportunity.riskLevel)}>
                    <div className="flex items-center gap-1">
                      {getRiskIcon(opportunity.riskLevel)}
                      {opportunity.riskLevel}
                    </div>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Yield Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">PT Yield</div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {opportunity.ptYield.toFixed(2)}%
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Borrow Rate</div>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {opportunity.borrowRate.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Yield Spread */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Yield Spread
                    </span>
                    <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      +{opportunity.yieldSpread.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Leverage Information */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Leveraged APY Estimates
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="font-medium">2x</div>
                      <div className="text-green-600 dark:text-green-400">
                        {Math.min(opportunity.estimatedApyAt2x, 999).toFixed(1)}%{opportunity.estimatedApyAt2x > 999 ? '+' : ''}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="font-medium">3x</div>
                      <div className="text-green-600 dark:text-green-400">
                        {Math.min(opportunity.estimatedApyAt3x, 999).toFixed(1)}%{opportunity.estimatedApyAt3x > 999 ? '+' : ''}
                      </div>
                    </div>
                    {opportunity.estimatedApyAt4x > 0 && (
                      <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="font-medium">4x</div>
                        <div className="text-green-600 dark:text-green-400">
                          {Math.min(opportunity.estimatedApyAt4x, 999).toFixed(1)}%{opportunity.estimatedApyAt4x > 999 ? '+' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    APY = PT Yield × Leverage - Borrow Rate × (Leverage - 1) • Gas costs not included
                  </div>
                </div>

                {/* Risk Information */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Max Safe Leverage</span>
                    <span className="font-medium">{opportunity.maxLeverage.toFixed(1)}x</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Liquidation Threshold</span>
                    <span className="font-medium">{opportunity.liquidationThreshold.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Available Liquidity</span>
                    <span className="font-medium">{formatLiquidity(opportunity.availableLiquidity)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Risk Warning */}
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={16} />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <div className="font-medium mb-2">Important Considerations</div>
              <div className="space-y-1 text-xs">
                <div>• <strong>APY estimates exclude gas costs</strong> - Multiple transactions required for looping</div>
                <div>• <strong>PT token expiry risk</strong> - Positions must be closed before token expiration</div>
                <div>• <strong>Leverage amplifies risks</strong> - Both gains and losses are magnified</div>
                <div>• <strong>Interest rate volatility</strong> - Borrow rates and PT yields can change rapidly</div>
                <div>• <strong>Liquidation threshold</strong> - Position liquidated if collateral value drops below threshold</div>
                <div>• <strong>Available liquidity limits</strong> - Large positions may face execution constraints</div>
                <div>• <strong>Smart contract risks</strong> - Pendle and Morpho protocol risks apply</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleMessage>
  )
}
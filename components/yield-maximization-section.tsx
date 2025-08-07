'use client'

import { ToolInvocation } from 'ai'
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, DollarSign, PieChart, Shield, Target, TrendingUp } from 'lucide-react'
import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { ToolArgsSection } from './section'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'

interface YieldMaximizationSectionProps {
  tool: ToolInvocation
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

// Simple progress bar component
const ProgressBar = ({ value, className = '' }: { value: number, className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
)

export function YieldMaximizationSection({
  tool,
  isOpen,
  onOpenChange
}: YieldMaximizationSectionProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  if (tool.state !== 'result' || !tool.result) {
    return <DefaultSkeleton />
  }

  const toolResult = typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
  const result = toolResult || {}

  const header = (
    <ToolArgsSection tool="yield-maximization">
      🔗 Pendle Yield Maximization
    </ToolArgsSection>
  )

  // Handle error states
  if (!result.success) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="text-center p-8 text-red-600">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Error</p>
          <p className="text-sm">{result.error}</p>
        </div>
      </CollapsibleMessage>
    )
  }

  const { data } = result
  const { opportunities = [], statistics = {}, searchCriteria = {}, nextSteps = [] } = data || {}

  // Handle empty results
  if (!data || (!data.portfolioAnalysis && opportunities.length === 0)) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="text-center p-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No Pendle Opportunities Found</p>
          <p className="text-sm">
            Try adjusting your criteria: risk level ({searchCriteria.riskLevel}), 
            {searchCriteria.minApy && ` min APY (${searchCriteria.minApy}%),`}
            {searchCriteria.maxApy && ` max APY (${searchCriteria.maxApy}%),`}
            or network ({searchCriteria.networkId}).
          </p>
        </div>
      </CollapsibleMessage>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`
    return `$${num.toFixed(0)}`
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getProtocolIcon = (protocol: string) => {
    return '🔗'  // Always Pendle now
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'hold': return '✅'
      case 'optimize': return '🔄'
      case 'diversify': return '📊'
      default: return '💡'
    }
  }

  // Check the action type for different displays
  const isPortfolioAnalysis = result.action === 'analyze' || data.portfolioAnalysis
  const isExecutionResult = result.action === 'execute'
  const executionGuidance = data.executionGuidance
  const selectedOpportunity = data.selectedOpportunity
  const portfolioAnalysis = data.portfolioAnalysis

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      <div className="space-y-6">
        {/* Portfolio Analysis Section */}
        {isPortfolioAnalysis && portfolioAnalysis && (
          <div className="space-y-6">
            {/* Portfolio Health Overview */}
            <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
              <div className="flex items-center space-x-2 mb-4">
                <Activity className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">📊 Portfolio Health Analysis</h3>
              </div>
              
              {/* Health Score Summary */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getHealthScoreColor(portfolioAnalysis.healthScore.overallScore)}`}>
                      {portfolioAnalysis.healthScore.overallScore}/100
                    </div>
                    <div className="text-sm text-gray-600">Overall Score</div>
                    <ProgressBar value={portfolioAnalysis.healthScore.overallScore} className="mt-2" />
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {portfolioAnalysis.summary.currentAvgYield.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Current Yield</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      vs {portfolioAnalysis.summary.optimalAvgYield.toFixed(1)}% optimal
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      +{portfolioAnalysis.summary.improvementPotential.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Improvement</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatNumber(portfolioAnalysis.summary.totalMissedAnnualValue)} annual
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatNumber(portfolioAnalysis.totalValue)}
                    </div>
                    <div className="text-sm text-gray-600">Total Value</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {portfolioAnalysis.positions.length} positions
                    </div>
                  </div>
                </div>
              </div>

              {/* Health Metrics Detail */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Yield Efficiency</p>
                      <p className="text-lg font-semibold">{portfolioAnalysis.healthScore.yieldEfficiency}%</p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                  <ProgressBar value={portfolioAnalysis.healthScore.yieldEfficiency} className="mt-2" />
                </Card>
                
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Risk Balance</p>
                      <p className="text-lg font-semibold">{portfolioAnalysis.healthScore.riskBalance}%</p>
                    </div>
                    <Shield className="h-6 w-6 text-blue-500" />
                  </div>
                  <ProgressBar value={portfolioAnalysis.healthScore.riskBalance} className="mt-2" />
                </Card>
                
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Diversification</p>
                      <p className="text-lg font-semibold">{portfolioAnalysis.healthScore.diversification}%</p>
                    </div>
                    <PieChart className="h-6 w-6 text-purple-500" />
                  </div>
                  <ProgressBar value={portfolioAnalysis.healthScore.diversification} className="mt-2" />
                </Card>
              </div>
            </div>

            {/* Current Positions */}
            <div>
              <h3 className="text-lg font-semibold mb-4">💰 Current Portfolio Positions</h3>
              <div className="space-y-3">
                {portfolioAnalysis.positions.slice(0, 5).map((position: any, index: number) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">💎</div>
                        <div>
                          <h4 className="font-medium">{position.tokenSymbol}</h4>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>{position.balance.toFixed(4)} tokens</span>
                            <span>•</span>
                            <span>{formatNumber(position.balanceUsd)}</span>
                            {position.isYieldPosition && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                  {position.currentYield.toFixed(1)}% APY
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          {position.currentYield > 0 ? `${position.currentYield.toFixed(1)}%` : '0%'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {position.isYieldPosition ? 'Earning' : 'Idle'}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Yield Gap Analysis */}
            <div>
              <h3 className="text-lg font-semibold mb-4">📊 Yield Optimization Opportunities</h3>
              <div className="space-y-3">
                {portfolioAnalysis.yieldGaps.slice(0, 5).map((gap: any, index: number) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">{getRecommendationIcon(gap.recommendation)}</div>
                        <div>
                          <h4 className="font-medium">{gap.tokenSymbol}</h4>
                          <div className="text-sm text-gray-600">{gap.reason}</div>
                          {gap.bestOpportunityName !== 'None found' && (
                            <div className="text-xs text-blue-600 mt-1">
                              → {gap.bestOpportunityName} ({gap.bestOpportunityApy.toFixed(1)}% APY)
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          {gap.yieldGap > 0 ? (
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={`font-semibold ${gap.yieldGap > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {gap.yieldGap > 0 ? '+' : ''}{gap.yieldGap.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {gap.potentialAnnualGain > 0 ? formatNumber(gap.potentialAnnualGain) : '$0'} annually
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Rebalancing Strategies */}
            {portfolioAnalysis.strategies && portfolioAnalysis.strategies.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">🎯 Recommended Rebalancing Strategies</h3>
                <div className="space-y-4">
                  {portfolioAnalysis.strategies.map((strategy: any, index: number) => (
                    <Card key={index} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold">{strategy.name}</h4>
                          <p className="text-sm text-gray-600">{strategy.description}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={getRiskColor(strategy.riskLevel)}>
                            {strategy.riskLevel}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-green-50 rounded">
                          <div className="text-lg font-bold text-green-600">
                            +{strategy.expectedYieldImprovement.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600">Yield Improvement</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded">
                          <div className="text-lg font-bold text-blue-600">
                            {formatNumber(strategy.estimatedAnnualGain)}
                          </div>
                          <div className="text-sm text-gray-600">Annual Gain</div>
                        </div>
                      </div>

                      {/* Execution Steps */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">📋 Execution Steps:</p>
                        <div className="space-y-2">
                          {strategy.executionSteps.map((step: any, stepIndex: number) => (
                            <div key={stepIndex} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {step.stepNumber}
                              </div>
                              <div className="flex-1">
                                <div className="font-mono text-sm text-blue-600">{step.action}</div>
                                <div className="text-xs text-gray-600">{step.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top 5 Opportunities for Portfolio Analysis */}
        {isPortfolioAnalysis && data.opportunities && data.opportunities.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">🏆 Top 5 Yield Maximization Opportunities</h3>
            <div className="space-y-3">
              {data.opportunities.slice(0, 5).map((opp: any, index: number) => (
                <Card key={opp.id || index} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-2xl">{getProtocolIcon(opp.protocol || 'pendle')}</div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{opp.name}</h4>
                          <Badge variant="outline" className={getRiskColor(opp.riskLevel)}>
                            {opp.riskLevel} risk
                          </Badge>
                          {opp.isStablecoin && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              Stablecoin
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span>{opp.symbol}</span>
                          <span className="mx-2">•</span>
                          <span>TVL: {formatNumber(opp.tvl)}</span>
                          <span className="mx-2">•</span>
                          <span>{opp.category}</span>
                          {opp.maturityDate && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Expires: {new Date(opp.maturityDate).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                        {opp.executionHint && (
                          <div className="text-xs text-blue-600 mt-1 font-mono">
                            💡 {opp.executionHint}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {opp.apy.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">APY</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps for Portfolio Analysis */}
        {isPortfolioAnalysis && data.opportunities && data.opportunities.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📋 Recommended Next Steps</h3>
            <Card className="p-4">
              <ul className="space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-muted-foreground">1.</span>
                  <span className="text-sm">
                    <strong>Start with highest APY:</strong> Consider investing in <span className="font-mono text-blue-600">{data.opportunities[0]?.name}</span> 
                    ({data.opportunities[0]?.apy.toFixed(1)}% APY)
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-muted-foreground">2.</span>
                  <span className="text-sm">
                    <strong>Execute investment:</strong> Use command <span className="font-mono text-blue-600 bg-gray-100 px-1 rounded">
                      &quot;Invest 1 ETH in {data.opportunities[0]?.symbol}&quot;
                    </span>
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-muted-foreground">3.</span>
                  <span className="text-sm">
                    <strong>Diversify gradually:</strong> After first investment, consider the second-best opportunity: <span className="font-mono text-blue-600">
                      {data.opportunities[1]?.name}
                    </span> ({data.opportunities[1]?.apy.toFixed(1)}% APY)
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-muted-foreground">4.</span>
                  <span className="text-sm">
                    <strong>Monitor positions:</strong> Track performance and consider rebalancing based on yield changes and maturity dates
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-muted-foreground">5.</span>
                  <span className="text-sm">
                    <strong>Stay updated:</strong> Run portfolio analysis regularly to identify new optimization opportunities
                  </span>
                </li>
              </ul>
            </Card>
          </div>
        )}

        {/* Execution Guidance Section */}
        {isExecutionResult && executionGuidance && (
          <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
            <div className="flex items-center space-x-2 mb-4">
              <Target className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">📋 Execution Plan</h3>
            </div>
            
            {/* Selected Opportunity Summary */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{selectedOpportunity.name}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="outline" className={getRiskColor(selectedOpportunity.riskLevel)}>
                      {selectedOpportunity.riskLevel} risk
                    </Badge>
                    <span className="text-sm text-gray-600">{selectedOpportunity.category}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedOpportunity.apy.toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-600">APY</div>
                </div>
              </div>
            </div>

            {/* Main Command */}
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-4">
              <div className="flex items-center justify-between">
                <span>{data.nextCommand}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => navigator.clipboard.writeText(data.nextCommand)}
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Alternative Commands */}
            {data.alternativeCommands && data.alternativeCommands.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Alternative commands:</p>
                <div className="space-y-2">
                  {data.alternativeCommands.map((cmd: string, index: number) => (
                    <div key={index} className="bg-gray-100 text-gray-800 p-2 rounded text-sm font-mono">
                      {cmd}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guidance Details */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">💡 What will happen:</p>
                <p className="text-sm text-gray-600">{executionGuidance.explanation}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">🎯 Expected outcome:</p>
                <p className="text-sm text-gray-600">{executionGuidance.expectedOutcome}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">⚠️ Risk assessment:</p>
                <p className="text-sm text-gray-600">{executionGuidance.riskSummary}</p>
              </div>
            </div>

            {/* Warnings */}
            {data.warnings && data.warnings.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Warnings</span>
                </div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {data.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Summary Statistics (for all actions) */}
        {!isPortfolioAnalysis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Highest APY</p>
                  <p className="text-lg font-bold text-green-600">
                    {statistics.highestApy?.toFixed(2)}%
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg APY</p>
                  <p className="text-lg font-bold">
                    {statistics.averageApy?.toFixed(2)}%
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total TVL</p>
                  <p className="text-lg font-bold">
                    {formatNumber(statistics.totalTvl || 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Opportunities</p>
                  <p className="text-lg font-bold">
                    {isExecutionResult ? data.topOpportunities?.length || 0 : opportunities.length}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Top Opportunities (for discovery and execution, not portfolio analysis) */}
        {!isPortfolioAnalysis && (
          <div>
            <h3 className="text-lg font-semibold mb-4">🏆 Top Opportunities</h3>
            <div className="space-y-3">
              {/* Show execution context opportunities if available, otherwise show discovery results */}
              {(isExecutionResult && data.topOpportunities ? data.topOpportunities : opportunities.slice(0, 5)).map((opp: any, index: number) => (
                <Card key={opp.id || index} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-2xl">{getProtocolIcon(opp.protocol || 'pendle')}</div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{opp.name}</h4>
                          <Badge variant="outline" className={getRiskColor(opp.riskLevel)}>
                            {opp.riskLevel} risk
                          </Badge>
                          {opp.isStablecoin && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              Stablecoin
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {opp.category || 'Yield Tokenization'} • Pendle
                          {opp.tvl > 0 && ` • TVL: ${formatNumber(opp.tvl)}`}
                          {opp.maturityDate && (
                            <span className="flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              Expires: {new Date(opp.maturityDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {opp.executionHint && (
                          <div className="text-xs text-muted-foreground mt-2">
                            💡 {opp.executionHint}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {opp.apy.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">APY</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {nextSteps.length > 0 && !isExecutionResult && !isPortfolioAnalysis && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📋 Next Steps</h3>
            <Card className="p-4">
              <ul className="space-y-2">
                {nextSteps.map((step: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* Protocol Distribution */}
        {statistics.protocolDistribution && Object.keys(statistics.protocolDistribution).length > 0 && !isPortfolioAnalysis && (
          <div>
            <h3 className="text-lg font-semibold mb-4">📊 Protocol Distribution</h3>
            <Card className="p-4">
              <div className="flex flex-wrap gap-2">
                {Object.entries(statistics.protocolDistribution).map(([protocol, count]: [string, any]) => (
                  <Badge key={protocol} variant="secondary" className="capitalize">
                    {getProtocolIcon(protocol)} {protocol}: {count}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Search Criteria */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <div className="flex flex-wrap gap-2">
            <span>Risk: {searchCriteria.riskLevel}</span>
            {searchCriteria.minApy && <span>• Min APY: {searchCriteria.minApy}%</span>}
            {searchCriteria.maxApy && <span>• Max APY: {searchCriteria.maxApy}%</span>}
            <span>• Network: {searchCriteria.networkId}</span>
            {searchCriteria.totalFound !== searchCriteria.totalShown && (
              <span>• Showing {searchCriteria.totalShown} of {searchCriteria.totalFound} results</span>
            )}
          </div>
        </div>
      </div>
    </CollapsibleMessage>
  )
} 
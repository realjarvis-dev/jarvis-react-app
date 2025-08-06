'use client'

import { ToolInvocation } from 'ai'
import { AlertTriangle, Clock, DollarSign, Shield, Target, TrendingUp } from 'lucide-react'
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
  const result = toolResult.data || toolResult || {}
  const opportunities = result.opportunities || []
  const statistics = result.statistics || {}
  const nextSteps = result.nextSteps || []
  const searchCriteria = result.searchCriteria || {}

  const header = (
    <ToolArgsSection tool="yield-maximization">
      🔗 Pendle Yield Maximization
    </ToolArgsSection>
  )

  if (result.error || toolResult.error || !toolResult.success) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="text-red-600">
          Error: {result.error || toolResult.error || 'Failed to analyze Pendle yield opportunities'}
        </div>
      </CollapsibleMessage>
    )
  }

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

  // Check if this is an execution result
  const isExecutionResult = result.action === 'execute'
  const executionGuidance = result.executionGuidance
  const selectedOpportunity = result.selectedOpportunity

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
                <span>{result.nextCommand}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => navigator.clipboard.writeText(result.nextCommand)}
                >
                  Copy
                </Button>
              </div>
            </div>

            {/* Alternative Commands */}
            {result.alternativeCommands && result.alternativeCommands.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Alternative commands:</p>
                <div className="space-y-2">
                  {result.alternativeCommands.map((cmd: string, index: number) => (
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
            {result.warnings && result.warnings.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Warnings</span>
                </div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {result.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Summary Statistics */}
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
                  {isExecutionResult ? result.topOpportunities?.length || 0 : opportunities.length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Top Opportunities */}
        <div>
          <h3 className="text-lg font-semibold mb-4">🏆 Top Opportunities</h3>
          <div className="space-y-3">
            {/* Show execution context opportunities if available, otherwise show discovery results */}
            {(isExecutionResult && result.topOpportunities ? result.topOpportunities : opportunities.slice(0, 5)).map((opp: any, index: number) => (
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

        {/* Next Steps */}
        {nextSteps.length > 0 && !isExecutionResult && (
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
        {statistics.protocolDistribution && Object.keys(statistics.protocolDistribution).length > 0 && (
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
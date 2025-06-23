'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Check, ChevronDown, Clock, Loader2, Play, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// Dynamic imports for UI components (to handle SSR)
const PendleOpportunitiesTable = dynamic(() => import('@/components/pendle-opportunities-table').then(mod => ({ default: mod.PendleOpportunitiesTable })), { ssr: false })
const KodiakOpportunitiesTable = dynamic(() => import('@/components/kodiak-opportunities-table').then(mod => ({ default: mod.KodiakOpportunitiesTable })), { ssr: false })
const SimpleQuoteDisplay = dynamic(() => import('@/components/simple-quote-display').then(mod => ({ default: mod.SimpleQuoteDisplay })), { ssr: false })
const KodiakBaultProfitability = dynamic(() => import('@/components/kodiak-bault-profitability').then(mod => ({ default: mod.KodiakBaultProfitability })), { ssr: false })

interface TestResult {
  toolName: string
  networkType: string
  networkContext: {
    network: string
    chainId: number
    isDemo: boolean
  }
  testConfig: any
  result: any
  executionTime: number
  timestamp: string
  error?: string
}

interface AvailableTests {
  ethereum_demo: string[]
  berachain_mainnet: string[]
}

export default function TestingFrameworkPage() {
  const [availableTests, setAvailableTests] = useState<AvailableTests | null>(null)
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map())
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load available tests on component mount
  useEffect(() => {
    loadAvailableTests()
  }, [])

  const loadAvailableTests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/test-tools')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setAvailableTests(data.availableTests)
      setError(null)
    } catch (err: any) {
      console.error('Error loading available tests:', err)
      setError(`Failed to load available tests: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runTest = async (toolName: string) => {
    try {
      setRunningTests(prev => new Set(prev).add(toolName))
      
      const response = await fetch(`/api/test-tools?tool=${encodeURIComponent(toolName)}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to run test')
      }
      
      setTestResults(prev => new Map(prev).set(toolName, result))
      setError(null)
    } catch (err: any) {
      console.error(`Error running test for ${toolName}:`, err)
      setTestResults(prev => new Map(prev).set(toolName, {
        toolName,
        networkType: 'unknown',
        networkContext: { network: 'unknown', chainId: 0, isDemo: false },
        testConfig: {},
        result: null,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        error: err.message
      }))
    } finally {
      setRunningTests(prev => {
        const newSet = new Set(prev)
        newSet.delete(toolName)
        return newSet
      })
    }
  }

  const runAllTests = async () => {
    if (!availableTests) return

    const allTools = [
      ...availableTests.ethereum_demo,
      ...availableTests.berachain_mainnet
    ]

    // Run tests sequentially to avoid overwhelming the server
    for (const toolName of allTools) {
      await runTest(toolName)
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  const clearResults = () => {
    setTestResults(new Map())
    setError(null)
  }

  const getTestStatus = (toolName: string) => {
    if (runningTests.has(toolName)) {
      return 'running'
    }
    const result = testResults.get(toolName)
    if (!result) {
      return 'pending'
    }
    return result.error ? 'error' : 'success'
  }

  const renderTestResult = (toolName: string, result: TestResult) => {
    if (result.error) {
      return (
        <Card className="mt-2 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="p-4 flex items-start gap-3">
            <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-red-900 dark:text-red-200">Error</div>
              <div className="text-sm text-red-700 dark:text-red-300">{result.error}</div>
            </div>
          </CardContent>
        </Card>
      )
    }

    // Render specific UI components based on tool type
    if (toolName === 'pendle_opportunities' && result.result?.data) {
      return (
        <div className="mt-2">
          <div className="mb-2 text-sm text-muted-foreground">
            Found {result.result.count} opportunities
          </div>
          <PendleOpportunitiesTable opportunities={result.result.data} />
        </div>
      )
    }

    if (toolName === 'pendle_quote' && result.result) {
      // Use the actual SimpleQuoteDisplay component that's used in the chat interface
      const mockTool = {
        state: 'result',
        result: result.result
      }
      return (
        <div className="mt-2">
          <div className="mb-2 text-sm text-muted-foreground">
            Quote generated successfully
          </div>
          <SimpleQuoteDisplay tool={mockTool} />
        </div>
      )
    }

    if (toolName === 'kodiak_opportunities' && result.result?.data) {
      return (
        <div className="mt-2">
          <div className="mb-2 text-sm text-muted-foreground">
            Found {result.result.data.length} opportunities
          </div>
          <KodiakOpportunitiesTable opportunities={result.result.data} />
        </div>
      )
    }

    if (toolName === 'kodiak_bault_profitability' && result.result) {
      // Use the actual KodiakBaultProfitability component that's used in the chat interface
      const mockTool = {
        state: 'result',
        result: result.result
      }
      return (
        <div className="mt-2">
          <div className="mb-2 text-sm text-muted-foreground">
            {result.result.summary || 'Bault profitability analysis completed'}
          </div>
          <KodiakBaultProfitability tool={mockTool} isOpen={true} onOpenChange={() => {}} />
        </div>
      )
    }

    // Generic result display for other tools
    return (
      <div className="mt-2">
        <div className="mb-2 text-sm text-muted-foreground">
          {result.result?.summary || 'Tool executed successfully'}
        </div>
        <div className="bg-muted p-3 rounded-md">
          <pre className="text-xs overflow-auto max-h-40">
            {JSON.stringify(result.result, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="absolute inset-0 overflow-auto">
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading testing framework...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error && !availableTests) {
    return (
      <div className="absolute inset-0 overflow-auto">
        <div className="container mx-auto py-8">
          <Card className="max-w-2xl mx-auto border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <CardContent className="p-6 flex items-start gap-3">
              <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-900 dark:text-red-200">Error</div>
                <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </CardContent>
          </Card>
          <div className="text-center mt-4">
            <Button onClick={loadAvailableTests}>Retry</Button>
          </div>
        </div>
      </div>
    )
  }

  const totalTests = availableTests ? 
    availableTests.ethereum_demo.length + availableTests.berachain_mainnet.length : 0
  const completedTests = testResults.size
  const successfulTests = Array.from(testResults.values()).filter(r => !r.error).length
  const failedTests = Array.from(testResults.values()).filter(r => r.error).length

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Tool Testing Framework</h1>
          <p className="text-muted-foreground mt-2">
            Test agent tools with predefined configurations across different networks.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{totalTests}</div>
              <div className="text-sm text-muted-foreground">Total Tests</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{successfulTests}</div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{failedTests}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{runningTests.size}</div>
              <div className="text-sm text-muted-foreground">Running</div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button 
            onClick={runAllTests} 
            disabled={runningTests.size > 0}
            className="flex items-center gap-2"
          >
            {runningTests.size > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run All Tests
          </Button>
          <Button 
            variant="outline" 
            onClick={clearResults}
            disabled={runningTests.size > 0}
          >
            Clear Results
          </Button>
          <Button 
            variant="outline" 
            onClick={loadAvailableTests}
            disabled={runningTests.size > 0}
          >
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <CardContent className="p-4 flex items-start gap-3">
              <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* Test Groups */}
        {availableTests && (
          <div className="space-y-6 pb-8">
            {/* Ethereum Tools (Demo Net) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Ethereum Tools (Demo Network)
                  <Badge variant="secondary">Demo</Badge>
                </CardTitle>
                <CardDescription>
                  Tests for Ethereum-based tools using demo network configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableTests.ethereum_demo.map(toolName => {
                  const status = getTestStatus(toolName)
                  const result = testResults.get(toolName)
                  
                  return (
                    <Collapsible key={toolName}>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                            {status === 'success' && <Check className="h-4 w-4 text-green-600" />}
                            {status === 'error' && <X className="h-4 w-4 text-red-600" />}
                            {status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                          </div>
                          <span className="font-medium">{toolName}</span>
                          {result && (
                            <Badge variant="outline" className="text-xs">
                              {result.executionTime}ms
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => runTest(toolName)}
                            disabled={status === 'running'}
                          >
                            {status === 'running' ? 'Running...' : 'Run Test'}
                          </Button>
                          {result && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </div>
                      </div>
                      {result && (
                        <CollapsibleContent>
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg ml-6">
                            <div className="text-sm text-muted-foreground mb-2">
                              Network: {result.networkContext.network} (Chain ID: {result.networkContext.chainId})
                              {result.networkContext.isDemo && ' - Demo Mode'}
                            </div>
                            {renderTestResult(toolName, result)}
                          </div>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  )
                })}
              </CardContent>
            </Card>

            {/* Berachain Tools (Mainnet) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Berachain Tools (Mainnet)
                  <Badge>Mainnet</Badge>
                </CardTitle>
                <CardDescription>
                  Tests for Berachain-based tools using mainnet configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableTests.berachain_mainnet.map(toolName => {
                  const status = getTestStatus(toolName)
                  const result = testResults.get(toolName)
                  
                  return (
                    <Collapsible key={toolName}>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                            {status === 'success' && <Check className="h-4 w-4 text-green-600" />}
                            {status === 'error' && <X className="h-4 w-4 text-red-600" />}
                            {status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                          </div>
                          <span className="font-medium">{toolName}</span>
                          {result && (
                            <Badge variant="outline" className="text-xs">
                              {result.executionTime}ms
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => runTest(toolName)}
                            disabled={status === 'running'}
                          >
                            {status === 'running' ? 'Running...' : 'Run Test'}
                          </Button>
                          {result && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </div>
                      </div>
                      {result && (
                        <CollapsibleContent>
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg ml-6">
                            <div className="text-sm text-muted-foreground mb-2">
                              Network: {result.networkContext.network} (Chain ID: {result.networkContext.chainId})
                              {result.networkContext.isDemo && ' - Demo Mode'}
                            </div>
                            {renderTestResult(toolName, result)}
                          </div>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// Add global styles to ensure scrolling works
const globalStyles = `
  .testing-framework-page {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = globalStyles
  document.head.appendChild(styleElement)
} 
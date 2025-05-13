'use client'

import { Card, CardContent } from '@/components/ui/card';

interface SimpleQuoteDisplayProps {
  tool: any;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SimpleQuoteDisplay({
  tool,
  isOpen,
  onOpenChange
}: SimpleQuoteDisplayProps) {
  if (tool.state !== 'result' || !tool.result) {
    return null
  }

  // Parse the result
  const result = typeof tool.result === 'string' ? JSON.parse(tool.result) : tool.result
  
  // Check if there's an error
  if (result.error) {
    return (
      <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-4">
          <div className="text-red-600 dark:text-red-400 font-medium mb-1">
            Error: Failed to get quote
          </div>
          <div className="text-sm text-red-600/80 dark:text-red-400/80">
            {result.error}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Display the quote result with an improved UI
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-900">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          {/* Market Name */}
          <div className="flex justify-between items-center pb-3 border-b border-blue-100 dark:border-blue-900">
            <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              Market
            </div>
            <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
              {result.market || 'Unknown Market'}
            </div>
          </div>
          
          {/* Main Rate Card */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Exchange Rate</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {result.rate || 'N/A'}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Inverse: {result.inverse_rate || 'N/A'}</div>
          </div>
          
          {/* Output Amount */}
          <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg p-4">
            <div className="flex justify-between">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
                For 1 ETH you receive:
              </div>
              <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
                {result.output_amount || 'N/A'} {result.market}
              </div>
            </div>
          </div>
          
          {/* Small timestamp note */}
          <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
            Quote valid as of {new Date().toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
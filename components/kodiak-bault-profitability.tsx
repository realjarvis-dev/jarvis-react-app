import { CollapsibleMessage } from './collapsible-message';
import { DefaultSkeleton } from './default-skeleton';
import { ToolArgsSection } from './section';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface KodiakBaultProfitabilityProps {
  tool: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KodiakBaultProfitability({ 
  tool, 
  isOpen, 
  onOpenChange 
}: KodiakBaultProfitabilityProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />;
  }

  const header = (
    <ToolArgsSection tool="kodiak_bault_profitability">{`Kodiak Bault Profitability`}</ToolArgsSection>
  );

  const toolResult = tool.result || {};
  const results = toolResult.data || [];
  const mostProfitable = toolResult.most_profitable;
  const count = toolResult.count || { total: 0, profitable: 0 };
  const error = toolResult.error;

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {error ? (
        <Card className="mb-4 border-red-500">
          <CardHeader className="py-3">
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Card */}
          <Card className="mb-4">
            <CardHeader className="py-3">
              <CardTitle>Bault Profitability Summary</CardTitle>
              <CardDescription className="mt-1">
                Profitability is calculated by comparing the amount of LP tokens obtainable from swapping iBGT to the bounty required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium">Total Baults Checked:</span>
                  <span>{count.total}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium">Profitable Baults:</span>
                  <span>{count.profitable}</span>
                </div>
                
                {mostProfitable && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <h3 className="font-semibold mb-2">Most Profitable Bault</h3>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>Pool:</span>
                        <span className="font-medium">{mostProfitable.staking_pool_name || 'Unknown Pool'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Profit Percentage:</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">{mostProfitable.profit_percentage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bounty Required:</span>
                        <span>{mostProfitable.formattedBounty || mostProfitable.bounty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>iBGT Amount:</span>
                        <span>{mostProfitable.formattedWrapperAmount || mostProfitable.wrapper_amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimated Output:</span>
                        <span>{mostProfitable.formattedEstimatedOutput || mostProfitable.estimated_output}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Profit:</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {mostProfitable.formattedProfit || mostProfitable.profit}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          {results.length > 0 ? (
            <Table className="border">
              <TableHeader>
                <TableRow>
                  <TableHead>Pool</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profit %</TableHead>
                  <TableHead>Bounty</TableHead>
                  <TableHead>iBGT Amount</TableHead>
                  <TableHead>Est. Output</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {('staking_pool_name' in result && result.staking_pool_name) ? 
                        result.staking_pool_name : 
                        <span className="text-muted-foreground">Unknown</span>
                      }
                    </TableCell>
                    <TableCell>
                      {'error' in result ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : result.is_profitable ? (
                        <Badge variant="default" className="bg-green-500">Profitable</Badge>
                      ) : result.is_ready ? (
                        <Badge variant="outline">Ready</Badge>
                      ) : (
                        <Badge variant="secondary">Not Ready</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {'profit_percentage' in result ? (
                        result.profit_percentage
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {'bounty' in result ? (
                        result.formattedBounty || result.bounty
                      ) : (
                        <span className="text-red-500">{result.error?.substring(0, 30)}{result.error?.length > 30 ? '...' : ''}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {'wrapper_amount' in result ? (
                        result.formattedWrapperAmount || result.wrapper_amount
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {'estimated_output' in result ? (
                        result.formattedEstimatedOutput || result.estimated_output
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div>No Bault data available.</div>
          )}
        </>
      )}
    </CollapsibleMessage>
  );
} 
import { CollapsibleMessage } from './collapsible-message';
import { DefaultSkeleton } from './default-skeleton';
import { ToolArgsSection } from './section';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface KodiakCompoundResultProps {
  tool: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KodiakCompoundResult({ 
  tool, 
  isOpen, 
  onOpenChange 
}: KodiakCompoundResultProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />;
  }

  const header = (
    <ToolArgsSection tool="kodiak_compound_bault">{`Kodiak Bault Compounding`}</ToolArgsSection>
  );

  const toolResult = tool.result || {};
  const status = toolResult.status || 'fail';
  const error = toolResult.error_message;
  const txHash = toolResult.transaction_hash;
  const poolName = toolResult.pool_name;
  const profitability = toolResult.profitability || {};

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {status === 'success' ? (
        <Card className="mb-4 border-green-500">
          <CardHeader className="py-3">
            <CardTitle className="text-green-500">Bault Successfully Compounded</CardTitle>
            <CardDescription>
              The transaction to compound the Bault has been successfully executed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">Pool:</span>
                <span>{poolName || toolResult.bault_address}</span>
              </div>
              
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">Transaction Hash:</span>
                <a 
                  href={`https://berascan.com/tx/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-500 hover:underline"
                >
                  {txHash?.substring(0, 10)}...{txHash?.substring(txHash.length - 8)}
                </a>
              </div>
              
              {profitability && (
                <>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Profit Percentage:</span>
                    <span className="text-green-600">{profitability.profit_percentage}</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Bounty:</span>
                    <span>{profitability.bounty}</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">iBGT Amount:</span>
                    <span>{profitability.wrapperAmount}</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Profit:</span>
                    <span className="text-green-600">{profitability.profit}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-4 border-red-500">
          <CardHeader className="py-3">
            <CardTitle className="text-red-500">Compounding Failed</CardTitle>
            {profitability && !profitability.isReady && (
              <CardDescription>
                The Bault is not currently profitable to compound.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-red-500 mb-4">{error}</div>
            
            {profitability && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-md">
                <h3 className="font-semibold mb-2">Profitability Analysis</h3>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant={profitability.isReady ? "default" : "destructive"}>
                      {profitability.isReady ? "Profitable" : "Not Profitable"}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Bounty Required:</span>
                    <span>{profitability.bounty}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>iBGT Amount:</span>
                    <span>{profitability.wrapperAmount}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Estimated Output:</span>
                    <span>{profitability.estimatedOutput}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Profit:</span>
                    <span>{profitability.profit}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </CollapsibleMessage>
  );
} 
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DepositParams } from "@/lib/kodiak/islandRatio";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

export default function KodiakTestPage() {
  const { ready, authenticated, user } = usePrivy();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [depositParams, setDepositParams] = useState<DepositParams>({
    islandAddress: '0x217b9476ecd8783c59ed0ed64c359b8f2b9ccd3a',
    totalAmount: '0.1',
    isToken0: true,
    slippageBPS: 50,
    minSharesReceived: '0.01'
  });

  const handleDeposit = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      
      const response = await fetch('/api/kodiak/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(depositParams),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error executing deposit:', error);
      setResult({ status: 'fail', error_message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Kodiak Island Deposit Test</h1>
      
      {!ready ? (
        <p>Loading...</p>
      ) : !authenticated ? (
        <p>Please log in to use this feature.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Deposit Parameters</CardTitle>
              <CardDescription>Configure your deposit to Kodiak Island</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="islandAddress">Island Address</Label>
                <Input 
                  id="islandAddress" 
                  value={depositParams.islandAddress} 
                  onChange={(e) => setDepositParams({...depositParams, islandAddress: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Amount to Deposit</Label>
                <Input 
                  id="totalAmount" 
                  value={depositParams.totalAmount} 
                  onChange={(e) => setDepositParams({...depositParams, totalAmount: e.target.value})}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="isToken0" 
                  checked={depositParams.isToken0}
                  onCheckedChange={(checked) => setDepositParams({...depositParams, isToken0: checked})}
                />
                <Label htmlFor="isToken0">Deposit Token0 (unchecked for Token1)</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slippageBPS">Slippage (in basis points, 1 = 0.01%)</Label>
                <Input 
                  id="slippageBPS" 
                  type="number"
                  value={depositParams.slippageBPS} 
                  onChange={(e) => setDepositParams({...depositParams, slippageBPS: parseInt(e.target.value)})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="minSharesReceived">Minimum Shares to Receive</Label>
                <Input 
                  id="minSharesReceived" 
                  value={depositParams.minSharesReceived} 
                  onChange={(e) => setDepositParams({...depositParams, minSharesReceived: e.target.value})}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleDeposit} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Processing...' : 'Execute Deposit'}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
              <CardDescription>Transaction result will appear here</CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="p-4 rounded-md bg-gray-50 dark:bg-gray-900">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                  
                  {result.status === 'success' && result.hash && (
                    <div className="mt-4">
                      <a 
                        href={`https://berascan.com/tx/${result.hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View on Explorer
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No result yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 
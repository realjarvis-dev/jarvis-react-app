'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';

interface KodiakInvestButtonProps {
  islandAddress: string;
  islandName?: string;
  defaultAmount?: string;
  network?: 'bepolia' | 'mainnet';
}

export default function KodiakInvestButton({
  islandAddress,
  islandName = 'Kodiak Island',
  defaultAmount = '0.01',
  network = 'mainnet'
}: KodiakInvestButtonProps) {
  const { ready, authenticated, user, login } = usePrivy();
  const [amount, setAmount] = useState(defaultAmount);
  const [slippage, setSlippage] = useState('0.5');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [islandInfo, setIslandInfo] = useState<any>(null);

  // Handle invest button click
  const handleInvest = async () => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      if (!ready || !authenticated) {
        await login();
        return;
      }

      // Validate input
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Fetch island info first
      const infoResponse = await fetch(`/api/kodiak/invest?islandAddress=${islandAddress}&network=${network}`);
      const infoData = await infoResponse.json();
      
      if (!infoData.success) {
        throw new Error(infoData.error || 'Failed to fetch island information');
      }
      
      setIslandInfo(infoData.islandInfo);
      
      // Confirm the investment
      const confirmInvest = window.confirm(
        `Are you sure you want to invest ${amount} BERA in ${islandName}?\n\nThis will execute a real transaction on the blockchain.`
      );
      
      if (!confirmInvest) {
        setIsLoading(false);
        return;
      }

      // Execute the investment
      const response = await fetch('/api/kodiak/invest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          islandAddress,
          amount,
          slippage: parseFloat(slippage),
          network
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to invest');
      }

      setTxHash(data.hash);
      
      // Add success message
      alert(`Investment submitted successfully! Transaction hash: ${data.hash}`);
    } catch (err: any) {
      console.error('Error investing:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Get explorer URL based on network
  const getExplorerUrl = (hash: string) => {
    return network === 'bepolia'
      ? `https://testnet-explorer.berachain.com/tx/${hash}`
      : `https://explorer.berachain.com/tx/${hash}`;
  };

  return (
    <div className="p-4 border rounded-md shadow-sm">
      <h3 className="text-lg font-medium">{islandName}</h3>
      <p className="text-sm text-gray-500 mb-4">Island Address: {islandAddress}</p>
      
      {islandInfo && (
        <div className="mb-4 p-2 bg-gray-50 rounded text-sm">
          <p>Token 0: {islandInfo.token0Balance} (Ratio: {(islandInfo.ratio0 * 100).toFixed(2)}%)</p>
          <p>Token 1: {islandInfo.token1Balance} (Ratio: {(islandInfo.ratio1 * 100).toFixed(2)}%)</p>
        </div>
      )}
      
      <div className="flex flex-col gap-4 mb-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount (BERA)
          </label>
          <input
            id="amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="slippage" className="block text-sm font-medium text-gray-700">
            Slippage (%)
          </label>
          <input
            id="slippage"
            type="text"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            placeholder="0.5"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>
      
      <button
        onClick={handleInvest}
        disabled={isLoading || !ready}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing...' : ready ? (authenticated ? 'Invest in Kodiak Island' : 'Connect Wallet') : 'Loading...'}
      </button>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {txHash && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
          <p>Transaction submitted!</p>
          <a
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            View on Explorer
          </a>
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500">
        <p>Network: {network === 'bepolia' ? 'Berachain Testnet (Bepolia)' : 'Berachain Mainnet'}</p>
        <p>Note: This will execute a real transaction on the blockchain.</p>
      </div>
    </div>
  );
} 
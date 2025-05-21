"use client";

import { WalletBalance } from '@/components/wallet-balance';
import { useWalletAddresses } from '@/lib/hooks/use-evm-and-sol-addresses';
import { usePrivy } from '@privy-io/react-auth'
export default function WalletPage() {
  // Sample wallet address (from the script)
  const { ready, authenticated, user } = usePrivy()
  const { evmAddress, solAddress } = useWalletAddresses(ready, authenticated, user)
  // const primaryWallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";


  return (
    <div className="container mx-auto py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Wallet Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            View and manage your cryptocurrency holdings
          </p>
        </div>
        
        <div className="flex justify-center">
          <WalletBalance walletAddress={evmAddress} className="w-full" />
        </div>
      </div>
    </div>
  );
} 
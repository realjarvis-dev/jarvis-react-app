import { WalletBalance } from '@/components/wallet-balance'
import { getUserEvmWalletAddress } from '@/lib/privy/client';
import { getWalletBalances } from '@/lib/utils/wallet';

export default async function WalletPage() {
  // Sample wallet address (from the script)

  const walletAddress = await getUserEvmWalletAddress()
    
  const balances = await getWalletBalances(walletAddress);

  // const primaryWallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  return (
    <div className="container mx-auto py-12 h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Wallet Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            View and manage your cryptocurrency holdings
          </p>
        </div>

        <div className="flex justify-center">
          <WalletBalance title="Wallet Balance" walletAddress={walletAddress} tokens={balances.tokens} isLoading={false} error={null} className="w-full" />
        </div>
      </div>
    </div>
  )
}

import { WalletBalance } from '@/components/wallet-balance'
import { getUserEvmWalletAddress } from '@/lib/privy/client'
import { getWalletBalances } from '@/lib/utils/wallet'
import { redirect } from 'next/navigation'
import { toast } from 'sonner'

export default async function WalletPage() {
  // Sample wallet address (from the script)
  let walletAddress;
  try {
    walletAddress = await getUserEvmWalletAddress()

  } catch (error) {
    // not found, redirect to home
    redirect('/')
  }

  const balances = await getWalletBalances(walletAddress)

  return (
    <div className="container mx-auto py-12 ">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Wallet Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            View and manage your cryptocurrency holdings
          </p>
        </div>

        <div className="flex justify-center">
          <WalletBalance
            title="Wallet Balance"
            walletAddress={walletAddress}
            tokens={balances.tokens}
            isLoading={false}
            error={null}
            className="w-full"
            filterOnNetwork={false}
          />
        </div>
      </div>
    </div>
  )
}

import WalletSummaryClient from './wallet-summary-client'

export default function WalletSummaryPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Wallet Intelligence</h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered analysis of your transaction history and DeFi behavior
          </p>
        </div>
        
        <WalletSummaryClient />
      </div>
    </div>
  )
} 
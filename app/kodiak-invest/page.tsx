import KodiakInvestButton from '@/components/kodiak-invest-button';

export default function KodiakInvestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Invest in Kodiak Island</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Mainnet Island</h2>
          <KodiakInvestButton 
            islandAddress="0x217b9476ecd8783c59ed0ed64c359b8f2b9ccd3a"
            islandName="WBERA-AIBERA Island"
            defaultAmount="0.01"
            network="mainnet"
          />
          <div className="mt-4 p-3 bg-yellow-50 rounded text-sm">
            <p className="font-medium">Island Details:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Fee Tier: 0.3%</li>
              <li>Price Range: 13.0380 - 2001.4354 AIBERA/WBERA</li>
              <li>Current Price: WBERA 1 = 128.614757 AIBERA</li>
              <li>TVL: 70032.28 WBERA + 8241036.32 AIBERA</li>
              <li>APR: 15.17%</li>
            </ul>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">About Kodiak Investment</h2>
          <div className="prose prose-sm">
            <p>
              Kodiak Islands are concentrated liquidity positions that allow you to earn fees
              on your liquidity provided to a specific price range. When you invest in a Kodiak Island:
            </p>
            <ul>
              <li>Your BERA will be automatically converted to the right ratio of tokens</li>
              <li>The liquidity will be provided to the Kodiak V3 pool</li>
              <li>You'll receive Kodiak Island LP tokens representing your position</li>
              <li>You'll earn fees from trades that occur within your position's price range</li>
            </ul>
            <p>
              The APR shown is historically based on trading volume and fees generated.
              Actual returns may vary based on market conditions and trading activity.
            </p>
            <p className="font-medium">
              Note: Make sure you have BERA in your wallet before investing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 
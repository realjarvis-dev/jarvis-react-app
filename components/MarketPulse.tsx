'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

const mockData = [
  { name: 'Bitcoin', symbol: 'BTCUSD', price: '$107.59k', change: '-0.18%', trend: 'down' },
  { name: 'Ethereum', symbol: 'ETHUSD', price: '$2.52k', change: '-0.52%', trend: 'down' },
  { name: 'XRP', symbol: 'XRPUSD', price: '$2.30', change: '-1.4%', trend: 'down' },
  { name: 'Solana', symbol: 'SOLUSD', price: '$172.21', change: '-2.17%', trend: 'down' },
]

export function MarketPulse() {
  return (
    <div className="flex overflow-x-auto gap-2 py-2 px-1 hide-scrollbar">
      {mockData.map((coin, index) => (
        <div key={index} className="min-w-[120px] bg-neutral-800 rounded-lg p-2 shadow-md">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-white">{coin.name}</span>
            <span className="text-xs text-gray-400">{coin.price}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">{coin.symbol}</span>
            <span className={`text-xs flex items-center gap-1 ${coin.trend === 'down' ? 'text-red-500' : 'text-green-500'}`}>
              {coin.trend === 'down' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {coin.change}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

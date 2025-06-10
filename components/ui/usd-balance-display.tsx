import { useUsdBalance } from '@/lib/hooks/use-usd-balance'
import { Skeleton } from './skeleton'

export function UsdBalanceDisplay() {
  const { data, isLoading, error } = useUsdBalance()

  if (isLoading) {
    return <Skeleton className="h-3 w-12" />
  }

  if (error || !data) {
    return null
  }

  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(data)

  return <div className="text-xs text-muted-foreground">{formattedBalance}</div>
}

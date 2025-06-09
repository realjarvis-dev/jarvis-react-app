// Performance-optimized approach: fast LCP + progressive enhancement

import { PerformanceOptimizedChat } from '@/components/performance-optimized-chat'

export default function Page() {
  const id = 'main-chat'

  return <PerformanceOptimizedChat id={id} />
}

// Remove force-dynamic to enable static optimization

import { CriticalWelcomeScreen } from '@/components/critical-welcome-screen'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Lazy load heavy chat component after LCP (removed ssr: false for server components)
const Chat = dynamic(() => import('@/components/chat').then(mod => ({ default: mod.Chat })), {
  loading: () => <CriticalWelcomeScreen />
})

export default function Page() {
  // Generate static ID to avoid server-side dependencies
  const id = 'main-chat'

  return (
    <Suspense fallback={<CriticalWelcomeScreen />}>
      <Chat id={id} />
    </Suspense>
  )
}

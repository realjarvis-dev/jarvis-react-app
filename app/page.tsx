// Ultra-minimal version to eliminate all render blocking

import { UltraMinimalChat } from '@/components/ultra-minimal-chat'

export default function Page() {
  // Ultra-minimal page with zero third-party dependencies
  const id = 'main-chat'

  return <UltraMinimalChat id={id} />
}

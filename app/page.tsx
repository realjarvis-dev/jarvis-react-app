// Original functionality restored with performance optimizations in place

import { Chat } from '@/components/chat'
import { generateId } from 'ai'

export default function Page() {
  const id = generateId()

  return <Chat id={id} />
}

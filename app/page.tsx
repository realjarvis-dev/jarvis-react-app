// Restored working chat with performance optimization

import { RestoredChat } from '@/components/restored-chat'
import { generateId } from 'ai'

export default function Page() {
  const id = generateId()

  return <RestoredChat id={id} />
}

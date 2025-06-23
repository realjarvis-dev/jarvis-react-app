export const dynamic = 'force-dynamic'

import { Chat } from '@/components/chat'
import { generateId } from 'ai'
import { cookies } from 'next/headers'

export default async function Page() {
  const id = generateId()
  const cookiesList = await cookies()

  return <Chat id={id} />
}

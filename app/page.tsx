export const dynamic = 'force-dynamic'

import { Chat } from '@/components/chat'
import { getModels } from '@/lib/config/models'
import { generateId } from 'ai'
import { cookies, headers } from 'next/headers'

export default async function Page() {
  const id = generateId()
  const models = await getModels()
  const cookiesList = await cookies()

  return <Chat id={id} models={models} />
}

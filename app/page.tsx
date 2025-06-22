export const dynamic = 'force-dynamic'

import { Chat } from '@/components/chat'
import { generateId } from 'ai'
import { cookies } from 'next/headers'
import { getServerSideUIState } from '@/lib/utils/server-cookies'

export default async function Page() {
  const id = generateId()
  const cookiesList = await cookies()
  const uiState = await getServerSideUIState()

  return <Chat id={id} initialUIState={uiState} />
}

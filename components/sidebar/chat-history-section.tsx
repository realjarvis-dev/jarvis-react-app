export const dynamic = 'force-dynamic'
export const revalidate = 0

import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar'
import { getChatsPage } from '@/lib/actions/chat'
import { getUserId } from '@/lib/privy/client'
import { headers } from 'next/headers'
import { ChatHistoryClient } from './chat-history-client'
import { ClearHistoryAction } from './clear-history-action'

export async function ChatHistorySection() {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  const headersList = await headers()

  let userId = 'anonymous'
  const cookies = headersList.get('cookie') || ''
  if (cookies.includes('privy-token=')) {
    try {
      userId = await getUserId()
    } catch (error) {
      console.log('Failed to get user id:', error)
      userId = headersList.get('x-user-id') || 'anonymous'
    }
  } else {
    userId = 'anonymous'
  }

  let { chats, nextOffset } = await getChatsPage(userId, 20, 0)
  if (userId === 'anonymous') {
    chats = []
    nextOffset = null
  }
  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
          <ClearHistoryAction empty={!chats?.length && !nextOffset} />
        </div>
      </SidebarGroup>
      <ChatHistoryClient initialChats={chats} initialNextOffset={nextOffset} />
    </div>
  )
}

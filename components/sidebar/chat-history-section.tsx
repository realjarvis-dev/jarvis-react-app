'use client'

import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar'
import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import { useEffect, useRef, useState } from 'react'
import { ChatHistoryClient } from './chat-history-client'
import { ClearHistoryAction } from './clear-history-action'

export function ChatHistorySection() {
  const renderCount = useRef(0)
  const { ready, authenticated, user } = usePrivy()
  const [chatsData, setChatsData] = useState<{
    chats: any[]
    nextOffset: number
  }>({ chats: [], nextOffset: 0 })
  const [loading, setLoading] = useState(true)

  renderCount.current += 1

  useEffect(() => {
    async function fetchHistory() {
      if (!ready) {
        return
      }

      let userId = 'anonymous'
      let headers: Record<string, string> = {
        'x-user-id': userId
      }

      if (authenticated && user) {
        userId = user.id
        try {
          const token = await getAccessToken()
          headers = {
            'x-user-id': userId,
            Authorization: `Bearer ${token}`
          }
        } catch (error) {
          console.log('Failed to get auth token', error)
        }
      }

      try {
        const response = await fetch('/api/chats?offset=0&limit=20', {
          headers
        })
        if (!response.ok) {
          throw new Error('Failed to fetch chat history')
        }
        const { chats, nextOffset } = await response.json()
        setChatsData({ chats, nextOffset: nextOffset || 0 })
      } catch (error) {
        console.log('Error fetching chats', error)
        setChatsData({ chats: [], nextOffset: 0 })
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [ready, authenticated, user])

  if (loading) {
    return <div className="p-4">Loading history…</div>
  }

  if (process.env.NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY !== 'true') {
    return null
  }

  return (
    <div className="flex flex-col flex-1 h-full">
      <SidebarGroup>
        <div className="flex items-center justify-between w-full">
          <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
          <ClearHistoryAction empty={!chatsData.chats.length} />
        </div>
      </SidebarGroup>
      <ChatHistoryClient
        initialChats={chatsData.chats}
        initialNextOffset={chatsData.nextOffset}
      />
    </div>
  )
}

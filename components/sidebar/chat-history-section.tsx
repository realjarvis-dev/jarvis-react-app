export const dynamic = 'force-dynamic'
export const revalidate = 0

import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar'
import { getChatsPage } from '@/lib/actions/chat'
import { privy } from '@/lib/privy/client'
import { headers } from 'next/headers'
import { ChatHistoryClient } from './chat-history-client'
import { ClearHistoryAction } from './clear-history-action'

export async function ChatHistorySection() {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return null
  }

  // Fetch the initial page of chats
  const headersList = await headers()

  const authToken = headersList.get('authorization')?.replace(/^Bearer /, '')

  let userId = 'anonymous'

  if (authToken) {
    try {
      const claims = await privy.verifyAuthToken(authToken)
      userId = claims.userId
    } catch (error) {
      console.error('Failed to verify auth token:', error)
    }
  } else {
    console.log('No auth token found in headers')
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
// 'use client'
// import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar'
// import { getAccessToken, usePrivy } from '@privy-io/react-auth'
// import { useEffect, useRef, useState } from 'react'
// import { ChatHistoryClient } from './chat-history-client'
// import { ClearHistoryAction } from './clear-history-action'

// // Immediate console log to verify module loading
// console.log('[ChatHistorySection] Module loaded')

// // Logger utility
// const logger = {
//   render: (message: string, data?: any) => {
//     console.log(`[ChatHistorySection Render] ${message}`, data || '')
//   },
//   state: (message: string, data?: any) => {
//     console.log(`[ChatHistorySection State] ${message}`, data || '')
//   },
//   effect: (message: string, data?: any) => {
//     console.log(`[ChatHistorySection Effect] ${message}`, data || '')
//   }
// }

// export function ChatHistorySection() {
//   // Immediate console log to verify component function execution
//   console.log('[ChatHistorySection] Component function called')

//   const renderCount = useRef(0)
//   const { ready, authenticated, user } = usePrivy()
//   const [chatsData, setChatsData] = useState<{
//     chats: any[]
//     nextOffset: number
//   }>({ chats: [], nextOffset: 0 })
//   const [loading, setLoading] = useState(true)

//   // Log initial render and re-renders
//   renderCount.current += 1
//   logger.render(`Component rendered (count: ${renderCount.current})`, {
//     ready,
//     authenticated,
//     userId: user?.id,
//     loading,
//     chatsCount: chatsData.chats.length
//   })

//   // Log state changes
//   useEffect(() => {
//     logger.state('State changed', {
//       ready,
//       authenticated,
//       userId: user?.id,
//       loading,
//       chatsCount: chatsData.chats.length
//     })
//   }, [ready, authenticated, user, loading, chatsData])

//   useEffect(() => {
//     async function fetchHistory() {
//       if (!ready) {
//         logger.effect('Skipping fetch - not ready')
//         return
//       }

//       let userId = 'anonymous'
//       let headers: Record<string, string> = {
//         'x-user-id': userId
//       }

//       if (authenticated && user) {
//         userId = user.id
//         try {
//           const token = await getAccessToken()
//           headers = {
//             'x-user-id': userId,
//             Authorization: `Bearer ${token}`
//           }
//           logger.effect('Got auth token', { userId })
//         } catch (error) {
//           logger.effect('Failed to get auth token', error)
//         }
//       }

//       try {
//         logger.effect('Fetching chats', { userId })
//         const response = await fetch('/api/chats?offset=0&limit=20', {
//           headers
//         })
//         if (!response.ok) {
//           throw new Error('Failed to fetch chat history')
//         }
//         const { chats, nextOffset } = await response.json()
//         logger.effect('Fetched chats successfully', {
//           chatsCount: chats.length,
//           nextOffset
//         })
//         setChatsData({ chats, nextOffset: nextOffset || 0 })
//       } catch (error) {
//         logger.effect('Error fetching chats', error)
//         setChatsData({ chats: [], nextOffset: 0 })
//       } finally {
//         setLoading(false)
//       }
//     }

//     fetchHistory()
//   }, [ready, authenticated, user])

//   if (loading) {
//     logger.render('Rendering loading state')
//     return <div className="p-4">Loading history…</div>
//   }

//   // Only show if feature flag on
//   if (process.env.NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY !== 'true') {
//     logger.render(
//       'Feature flag disabled - not rendering',
//       process.env.ENABLE_SAVE_CHAT_HISTORY
//     )
//     return null
//   }

//   // Add logging before rendering ChatHistoryClient
//   logger.render('About to render ChatHistoryClient', {
//     chatsCount: chatsData.chats.length,
//     nextOffset: chatsData.nextOffset
//   })

//   return (
//     <div className="flex flex-col flex-1 h-full">
//       <SidebarGroup>
//         <div className="flex items-center justify-between w-full">
//           <SidebarGroupLabel className="p-0">History</SidebarGroupLabel>
//           <ClearHistoryAction empty={!chatsData.chats.length} />
//         </div>
//       </SidebarGroup>
//       <ChatHistoryClient
//         initialChats={chatsData.chats}
//         initialNextOffset={chatsData.nextOffset}
//       />
//     </div>
//   )
// }

import { getChatsPage } from '@/lib/actions/chat'
import { privy } from '@/lib/privy/client'
import { type Chat } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

interface ChatPageResponse {
  chats: Chat[]
  nextOffset: number | null
}

export async function GET(request: NextRequest) {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return NextResponse.json<ChatPageResponse>({ chats: [], nextOffset: null })
  }

  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  const privyToken = request.cookies.get('privy-token')?.value

  let userId = 'anonymous'
  if (privyToken) {
    const claims = await privy.verifyAuthToken(privyToken)
    userId = claims.userId
  }

  if (userId === 'anonymous') {
    return NextResponse.json<ChatPageResponse>({ chats: [], nextOffset: null })
  }

  console.log('userId in chats route', userId)

  try {
    const result = await getChatsPage(userId, limit, offset)
    return NextResponse.json<ChatPageResponse>(result)
  } catch (error) {
    console.error('API route error fetching chats:', error)
    return NextResponse.json<ChatPageResponse>(
      { chats: [], nextOffset: null },
      { status: 500 }
    )
  }
}

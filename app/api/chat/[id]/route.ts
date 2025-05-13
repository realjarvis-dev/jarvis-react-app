import { deleteChat, getChat } from '@/lib/actions/chat'
import { verifyAccessToken } from '@/lib/privy/client'
import { convertToUIMessages } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id')
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  if (userId !== 'anonymous') {
    let payload: any
    try {
      payload = await verifyAccessToken()
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    // only authenticated user, payload.sub should match userId
    if (payload.sub !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { id } = await params

  const chat = await getChat(id, userId || 'anonymous')
  if (!chat) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // convertToUIMessages for useChat hook
  const messages = convertToUIMessages(chat?.messages || [])

  return NextResponse.json({ messages })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const enableSaveChatHistory = process.env.ENABLE_SAVE_CHAT_HISTORY === 'true'
  if (!enableSaveChatHistory) {
    return NextResponse.json(
      { error: 'Chat history saving is disabled.' },
      { status: 403 }
    )
  }

  const userId = request.headers.get('x-user-id') || 'anonymous'
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  if (userId !== 'anonymous') {
    let payload: any
    try {
      payload = await verifyAccessToken()
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    // only authenticated user, payload.sub should match userId
    if (payload.sub !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const chatId = (await params).id
  if (!chatId) {
    return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
  }

  try {
    const result = await deleteChat(chatId, userId)

    if (result.error) {
      const statusCode = result.error === 'Chat not found' ? 404 : 500
      return NextResponse.json({ error: result.error }, { status: statusCode })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(`API route error deleting chat ${chatId}:`, error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

import { Chat } from '@/components/chat'
import { getChat } from '@/lib/actions/chat'
import { getModels } from '@/lib/config/models'
import { privy } from '@/lib/privy/client'
import { convertToUIMessages } from '@/lib/utils'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
export const maxDuration = 60

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const headersList = await headers()
  // console.log('All headers:', Object.fromEntries(headersList.entries()))

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
  const chat = await getChat(id, userId)
  return {
    title: chat?.title.toString().slice(0, 50) || 'Search'
  }
}

export default async function SearchPage(props: {
  params: Promise<{ id: string }>
}) {
  const cookiesList = await cookies()
  console.log(
    'Privy token from cookies:',
    cookiesList.get('privy-token')?.value
  )
  const headersList = await headers()
  // console.log('All headers:', Object.fromEntries(headersList.entries()))

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

  const { id } = await props.params

  const chat = await getChat(id, userId)
  // convertToUIMessages for useChat hook
  const messages = convertToUIMessages(chat?.messages || [])

  if (!chat) {
    console.log('No chat found')
    redirect('/')
  }
  console.log(
    'UserId difference in <search />[id]/page.tsx',
    chat?.userId,
    userId
  )
  if (chat?.userId !== userId && chat?.userId !== 'anonymous') {
    console.log('Chat user ID does not match user ID')
    notFound()
  }

  const models = await getModels()
  return <Chat id={id} savedMessages={messages} models={models} />
}

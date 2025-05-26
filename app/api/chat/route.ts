import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'
import { cookies } from 'next/headers'
import { getUser, getUserWallet } from '@/lib/privy/client'
import { getAnonId } from '@/lib/utils/anon-trials'
import { WalletWithMetadata } from '@privy-io/server-auth'
export const maxDuration = 30

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o mini',
  provider: 'OpenAI',
  providerId: 'openai',
  enabled: true,
  toolCallType: 'native'
}

export async function POST(request: Request) {
  try {
    const { messages, id: chatId } = await request.json()
    const referer = request.headers.get('referer')
    const isSharePage = referer?.includes('/share/')
    const userId = request.headers.get('x-user-id') || 'anonymous'

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    const cookieStore = await cookies()
    const modelJson = cookieStore.get('selectedModel')?.value
    const searchMode = cookieStore.get('search-mode')?.value === 'true'

    let selectedModel = DEFAULT_MODEL

    if (modelJson) {
      try {
        selectedModel = JSON.parse(modelJson) as Model
      } catch (e) {
        console.error('Failed to parse selected model:', e)
      }
    }

    if (
      !isProviderEnabled(selectedModel.providerId) ||
      selectedModel.enabled === false
    ) {
      return new Response(
        `Selected provider is not enabled ${selectedModel.providerId}`,
        {
          status: 404,
          statusText: 'Not Found'
        }
      )
    }

    let authenticated = false
    try {
      await getUser()
      authenticated = true
    } catch (error) {
      console.log('User not logged in')
    }
    let userEvmWallet = undefined
    let userSolWallet = undefined
    if (authenticated) {
      userEvmWallet = await getUserWallet('ethereum')
      userSolWallet = await getUserWallet('solana')
    }



    const supportsToolCalling = selectedModel.toolCallType === 'native'
    console.log('supportsToolCalling', supportsToolCalling)
    return supportsToolCalling
      ? createToolCallingStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId,
          userEvmWallet,
          userSolWallet
        })
      : createManualToolStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId,
          userEvmWallet,
          userSolWallet
        })
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}

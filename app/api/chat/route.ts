import { getServerSideNetworkConfig } from '@/lib/network/gateway'
import { getUser, getUserWallet } from '@/lib/privy/client'
import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
import { Model } from '@/lib/types/models'
import { createNetworkContext } from '@/lib/utils/network-utils'
import { isProviderEnabled } from '@/lib/utils/registry'
import { cookies } from 'next/headers'

export const maxDuration = 30

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o',
  name: 'GPT-4o',
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
    const allowWeb3Tools = request.headers.get('allow-web3-tools') || 'readonly'

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    const cookieStore = await cookies()
    const searchModeValue = cookieStore.get('search-mode')?.value || 'true'
    const searchMode = searchModeValue === 'true'
    
    const deepResearchModeValue = cookieStore.get('deep-research-mode')?.value || 'false'
    const deepResearchMode = deepResearchModeValue === 'true'

    const selectedModel = DEFAULT_MODEL

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
    let isNewUser = false
    try {
      const user = await getUser()
      authenticated = true
      
      const created = new Date(user.createdAt)
      const now = new Date()
      isNewUser = now.getTime() - created.getTime() < 120_000
      
      console.log(`User created at: ${created.toISOString()}, isNewUser: ${isNewUser}`)
    } catch (error) {
      console.log('User not logged in')
    }
    let userEvmWallet = undefined
    let userSolWallet = undefined
    if (authenticated) {
      userEvmWallet = await getUserWallet('ethereum')
      userSolWallet = await getUserWallet('solana')
    }

    // Extract network context using getServerSideNetworkConfig
    let networkContext
    try {
      const serverDeterminedNetworkConfig = await getServerSideNetworkConfig()

      console.log('serverDeterminedNetworkConfig', serverDeterminedNetworkConfig)

      networkContext = createNetworkContext(
        serverDeterminedNetworkConfig.id, // Use chainId from the config
        serverDeterminedNetworkConfig.isDemo, // Use isDemo from the config
        serverDeterminedNetworkConfig // Pass the full config as activeNetwork
      )
    } catch (error) {
      console.error('Error creating network context:', error)
      // Continue without network context
    }

    const supportsToolCalling = selectedModel.toolCallType === 'native'
    console.log('supportsToolCalling', supportsToolCalling)
    return supportsToolCalling
      ? createToolCallingStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          deepResearchMode,
          userId,
          userEvmWallet,
          userSolWallet,
          allowWeb3Tools,
          networkContext,
          isNewUser
        })
      : createManualToolStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          deepResearchMode,
          userId,
          userEvmWallet,
          userSolWallet,
          allowWeb3Tools,
          networkContext,
          isNewUser
        })
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}

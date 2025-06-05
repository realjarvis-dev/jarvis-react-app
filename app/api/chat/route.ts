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
    const allowWeb3Tools = request.headers.get('allow-web3-tools') || 'false'

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    const cookieStore = await cookies()
    const searchMode = cookieStore.get('search-mode')?.value === 'true'

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

    // Extract network context using getServerSideNetworkConfig
    let networkContext
    try {
      // Assuming 'request' can be cast or adapted to NextApiRequest for cookie access.
      // This might need adjustment based on how 'request' (Fetch API Request) handles cookies
      // compared to NextApiRequest. For now, we'll assume direct usage or an adapter.
      // The 'req.cookies' part of getServerSideNetworkConfig will need careful handling
      // if 'request' is a standard Fetch API Request object.
      // For Next.js 13+ App Router, cookies() from 'next/headers' is the way.
      // We need to pass the raw 'Request' object to getServerSideNetworkConfig
      // and it should internally use 'next/headers' cookies() if needed, or be adapted.
      // Let's assume getServerSideNetworkConfig is adapted to work with Request or we pass cookies directly.

      // Modification: getServerSideNetworkConfig expects a NextApiRequest.
      // We need to adapt or pass the cookie data.
      // For app router, we use `cookies()` from `next/headers`.
      // Let's make `getServerSideNetworkConfig` compatible or create a new helper.
      // For now, we will simulate the NextApiRequest cookies object.
      const pseudoReq = {
        cookies: cookieStore.getAll().reduce((acc, cookie) => {
          acc[cookie.name] = cookie.value
          return acc
        }, {} as Record<string, string>)
      } as any // Cast to any to satisfy NextApiRequest typing for cookies

      const serverDeterminedNetworkConfig =
        getServerSideNetworkConfig(pseudoReq)

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
          userId,
          userEvmWallet,
          userSolWallet,
          allowWeb3Tools,
          networkContext
        })
      : createManualToolStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId,
          userEvmWallet,
          userSolWallet,
          allowWeb3Tools,
          networkContext
        })
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}

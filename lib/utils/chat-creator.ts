import { shareChat } from '@/lib/actions/chat'
import { ethereumConfig } from '@/lib/network/config'
import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
import { Model } from '@/lib/types/models'
import { createNetworkContext } from '@/lib/utils/network-utils'
import { generateId } from 'ai'

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o',
  name: 'GPT-4o',
  provider: 'OpenAI',
  providerId: 'openai',
  enabled: true,
  toolCallType: 'native'
}

export interface ChatCreationResult {
  chatId: string
  shareUrl: string
  query: string
  response: string
}

export async function createChatWithShareableLink(
  userQuery: string,
  options: {
    userId?: string
    baseUrl?: string
    maxTokens?: number
  } = {}
): Promise<ChatCreationResult> {
  const {
    userId = 'twitter-chat-bot',
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    maxTokens = 2000
  } = options

  try {
    // Generate chat ID
    const chatId = generateId()
    
    // Create network context using existing Ethereum config
    const networkContext = createNetworkContext(
      ethereumConfig.id,
      ethereumConfig.isDemo,
      ethereumConfig
    )
    
    // Use the same model configuration as the chat API
    const selectedModel = DEFAULT_MODEL
    
    // Create messages array
    const messages = [
      {
        id: generateId(),
        role: 'user' as const,
        content: userQuery
      }
    ]

    // Use the same streaming infrastructure as normal chat
    const supportsToolCalling = selectedModel.toolCallType === 'native'
    
    // Create a promise to collect the streamed data
    let collectedMessages: any[] = []
    let collectedData: any[] = []
    let isComplete = false
    
    const streamResponse = supportsToolCalling
      ? createToolCallingStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode: true,
          userId,
          userEvmWallet: undefined,
          userSolWallet: undefined,
          allowWeb3Tools: 'readonly',
          networkContext,
          isNewUser: false
        })
      : createManualToolStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode: true,
          userId,
          userEvmWallet: undefined,
          userSolWallet: undefined,
          allowWeb3Tools: 'readonly',
          networkContext,
          isNewUser: false
        })

    // Read the response stream to ensure it completes
    const reader = streamResponse.body?.getReader()
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        // Parse the streamed data to extract messages and annotations
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data) {
                collectedData.push(data)
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    // Create shareable link
    const sharedChat = await shareChat(chatId, userId)
    
    if (!sharedChat || !sharedChat.sharePath) {
      throw new Error('Failed to create shareable link')
    }

    // Construct full URL
    const shareUrl = `${baseUrl}${sharedChat.sharePath}`

    // Extract the final response text from collected data
    let aiResponse = 'Response generated with tool calls.'
    const textParts = collectedData.filter(item => 
      typeof item === 'object' && 
      item.type === 'text-delta' || 
      item.type === 'text'
    )
    if (textParts.length > 0) {
      aiResponse = textParts.map(part => part.textDelta || part.text || '').join('')
    }

    return {
      chatId,
      shareUrl,
      query: userQuery,
      response: aiResponse
    }
  } catch (error) {
    console.error('❌ Error creating chat:', error)
    throw error
  }
} 
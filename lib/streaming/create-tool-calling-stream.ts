import { deepResearcher } from '@/lib/agents/deep-researcher'
import { researcher } from '@/lib/agents/researcher'
import {
    convertToCoreMessages,
    createDataStreamResponse,
    DataStreamWriter,
    streamText
} from 'ai'
import { getMaxAllowedTokens, truncateMessages } from '../utils/context-window'
import { isReasoningModel } from '../utils/registry'
import { handleStreamFinish } from './handle-stream-finish'
import { BaseStreamConfig } from './types'

export function createToolCallingStreamResponse(config: BaseStreamConfig) {
  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { messages, model, chatId, searchMode, deepResearchMode, userId, allowWeb3Tools, isNewUser } = config
      const modelId = `${model.providerId}:${model.id}`

      try {
        const coreMessages = convertToCoreMessages(messages)
        const truncatedMessages = truncateMessages(
          coreMessages,
          getMaxAllowedTokens(model)
        )

        let researcherConfig

        // If deep research mode is enabled, use deep researcher instead
        if (deepResearchMode) {
          researcherConfig = deepResearcher({
            messages: truncatedMessages,
            model: modelId
          })
        } else {
          researcherConfig = await researcher({
            messages: truncatedMessages,
            model: modelId,
            searchMode,
            userEvmWallet: config.userEvmWallet,
            userSolWallet: config.userSolWallet,
            allowWeb3Tools,
            networkContext: config.networkContext,
            isNewUser: config.isNewUser
          })
        }

        // console.log('researcherConfig', researcherConfig)

        const result = streamText({
          ...researcherConfig,
          onFinish: async result => {
            // Skip related questions for reasoning models and deep research mode
            const shouldSkipRelatedQuestions =
              isReasoningModel(modelId) || deepResearchMode

            await handleStreamFinish({
              responseMessages: result.response.messages,
              originalMessages: messages,
              model: modelId,
              chatId,
              dataStream,
              userId,
              skipRelatedQuestions: shouldSkipRelatedQuestions
            })
          }
        })

        result.mergeIntoDataStream(dataStream)
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error
      }
    },
    onError: error => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    }
  })
}

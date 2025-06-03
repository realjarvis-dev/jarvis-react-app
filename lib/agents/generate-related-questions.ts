import { relatedSchema } from '@/lib/schema/related'
import { CoreMessage, generateObject } from 'ai'
import {
  getModel,
  getToolCallModel,
  isToolCallSupported
} from '../utils/registry'

export async function generateRelatedQuestions(
  messages: CoreMessage[],
  model: string
) {
  const lastMessages = messages.slice(-1).map(message => ({
    ...message,
    role: 'user'
  })) as CoreMessage[]

  console.log('lastMessages', lastMessages)

  const supportedModel = isToolCallSupported(model)
  const currentModel = supportedModel
    ? getModel(model)
    : getToolCallModel(model)


    try {
      const result = await generateObject({
        model: currentModel,
        system: `
    ## Purpose
    As a professional web researcher with DeFi expertise, your task is to generate a set of three queries that explore the subject matter more deeply, building upon the initial query and the information uncovered in its search results.
    
    ## Project context
    - **Kodiak Island** is a DeFi investment product, not a real place.  
    - **Pendle** is a protocol for trading future yield.
    
    ## Guidelines
    1. Build on the user's original topic  
    2. Leverage any insights uncovered in initial results about <protocol>’s products or services 
    3. Progressively dive into more specific features, implications or adjacent topics. The goal is to anticipate the user's potential information needs and guide them towards a more comprehensive understanding of the subject matter.  
    4. Don't ask what opportunities are available on <protocol> if tool already called


    ## Output format
    Your output should be in the same language as the user’s request and follow this format:

    **[Broad contextual deep dive query]**  
    **[Focused technical comparison or mechanism query]**  
    **[Advanced implications or synergy query]** `,
        messages: lastMessages,
        schema: relatedSchema
      })
      return result // Success, exit the loop and return
    } catch (error) {
      // console.log('Error generating related questions:', error)
      throw error
    }
}


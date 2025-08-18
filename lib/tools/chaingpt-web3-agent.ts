import { GeneralChat } from '@chaingpt/generalchat'
import { tool } from 'ai'
import { z } from 'zod'

// ChainGPT Web3 Agent types
interface ChainGPTResponse {
  response: string
  timestamp: string
  source: 'ChainGPT Web3 AI'
  context?: string
  error?: string
}

/**
 * Creates a simplified ChainGPT Web3 agent tool for handling Web3 domain questions
 * This version uses basic API calls without complex context injection to debug the "Bad Request Exception"
 */
export const chainGPTWeb3AgentTool = tool({
  description: 'Use ChainGPT Web3 AI agent to answer complex Web3, DeFi, blockchain, and cryptocurrency questions with expert knowledge and real-time insights',
  parameters: z.object({
    question: z.string().describe('The Web3/DeFi/blockchain question to ask the ChainGPT AI agent'),
    context: z.string().optional().describe('Additional context about the user\'s situation or specific requirements'),
    response_type: z.enum(['comprehensive', 'concise', 'technical', 'beginner_friendly']).default('comprehensive').describe('Type of response needed'),
    domain_focus: z.enum(['defi', 'nft', 'trading', 'development', 'security', 'general_web3']).optional().describe('Specific Web3 domain to focus on'),
    include_examples: z.boolean().default(true).describe('Whether to include practical examples in the response'),
    tone: z.enum(['professional', 'friendly', 'technical', 'educational']).default('professional').describe('Tone of the response'),
    save_history: z.boolean().default(false).describe('Whether to save this conversation for future reference'),
    user_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate').describe('User\'s experience level with Web3/DeFi')
  }),
  execute: async (params) => {
    const {
      question,
      context,
      response_type = 'comprehensive',
      domain_focus,
      include_examples = true,
      tone = 'professional',
      save_history = false,
      user_level = 'intermediate'
    } = params

    const apiKey = process.env.CHAINGPT_API_KEY
    if (!apiKey) {
      console.error('Environment variables available:', Object.keys(process.env).filter(key => key.includes('CHAINGPT')))
      throw new Error('CHAINGPT_API_KEY is not set in environment variables')
    }

    try {
      // Initialize ChainGPT client with timeout configuration
      console.log('Initializing ChainGPT client with API key:', apiKey ? 'Present' : 'Missing')
      console.log('API key length:', apiKey?.length)
      console.log('API key starts with:', apiKey?.substring(0, 10) + '...')
      console.log('Environment check - NODE_ENV:', process.env.NODE_ENV)
      
      const generalchat = new GeneralChat({
        apiKey: apiKey
      })

      // Construct enhanced prompt based on parameters
      let enhancedQuestion = question

      // Add context if provided
      if (context) {
        enhancedQuestion = `Context: ${context}\n\nQuestion: ${question}`
      }

      // Add domain-specific instructions
      if (domain_focus) {
        const domainInstructions = {
          defi: 'Focus on DeFi protocols, yield farming, liquidity provision, and decentralized finance strategies.',
          nft: 'Focus on NFT markets, collections, trading strategies, and digital asset management.',
          trading: 'Focus on cryptocurrency trading, market analysis, and trading strategies.',
          development: 'Focus on blockchain development, smart contracts, and technical implementation.',
          security: 'Focus on Web3 security, best practices, and risk management.',
          general_web3: 'Provide comprehensive Web3 knowledge covering all aspects.'
        }
        enhancedQuestion += `\n\nPlease focus on: ${domainInstructions[domain_focus]}`
      }

      // Add response type instructions
      const responseInstructions = {
        comprehensive: 'Provide a detailed, thorough explanation with multiple perspectives.',
        concise: 'Provide a clear, concise answer focusing on key points.',
        technical: 'Provide technical details, code examples, and implementation specifics.',
        beginner_friendly: 'Explain in simple terms suitable for Web3 beginners.'
      }
      enhancedQuestion += `\n\nResponse style: ${responseInstructions[response_type]}`

      // Add user level context
      const levelContext = {
        beginner: 'The user is new to Web3/DeFi. Explain concepts clearly and avoid excessive jargon.',
        intermediate: 'The user has some Web3/DeFi experience. Balance detail with accessibility.',
        advanced: 'The user is experienced with Web3/DeFi. Provide advanced insights and technical details.'
      }
      enhancedQuestion += `\n\nUser level: ${levelContext[user_level]}`

      // Add examples instruction
      if (include_examples) {
        enhancedQuestion += '\n\nPlease include practical examples where relevant.'
      }

      console.log('Enhanced question length:', enhancedQuestion.length)
      console.log('Enhanced question preview:', enhancedQuestion.substring(0, 200) + '...')

      // Generate unique session ID for history if requested
      const sessionId = save_history ? `web3-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : undefined

      // Try the simplest possible API call first
      console.log('Making simplified API call to ChainGPT...')
      console.log('Parameters:', {
        question: enhancedQuestion.substring(0, 100) + '...',
        chatHistory: save_history ? "on" : "off"
      })

      const response = await generalchat.createChatBlob({
        question: enhancedQuestion,
        chatHistory: save_history ? "on" : "off"
      })
      
      console.log('API call successful, response received')
      console.log('Response structure:', Object.keys(response))
      console.log('Response data structure:', response.data ? Object.keys(response.data) : 'No data')

      // Process and format the response
      const aiResponse = response.data.bot

      // Extract key insights and structure the response
      const structuredResponse: ChainGPTResponse = {
        response: aiResponse,
        timestamp: new Date().toISOString(),
        source: 'ChainGPT Web3 AI',
        context: context || undefined
      }

      return {
        ...structuredResponse,
        question: question,
        response_type,
        domain_focus,
        user_level,
        session_id: sessionId,
        metadata: {
          tone,
          include_examples,
          save_history,
          enhanced_prompt: enhancedQuestion
        }
      }

    } catch (error) {
      console.error('ChainGPT Web3 Agent error:', error)
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        generalChatError: (error as any)?.generalChatError
      })
      
      // Return structured error response
      return {
        response: 'I apologize, but I encountered an issue while processing your Web3 question. Please try again or rephrase your question.',
        timestamp: new Date().toISOString(),
        source: 'ChainGPT Web3 AI',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        question: question,
        response_type,
        domain_focus,
        user_level
      }
    }
  }
})

/**
 * Streaming version of ChainGPT Web3 agent for real-time responses
 */
export const chainGPTWeb3AgentStreamTool = tool({
  description: 'Use ChainGPT Web3 AI agent with streaming responses for real-time Web3/DeFi guidance',
  parameters: z.object({
    question: z.string().describe('The Web3/DeFi/blockchain question to ask the ChainGPT AI agent'),
    context: z.string().optional().describe('Additional context about the user\'s situation'),
    domain_focus: z.enum(['defi', 'nft', 'trading', 'development', 'security', 'general_web3']).optional().describe('Specific Web3 domain to focus on'),
    tone: z.enum(['professional', 'friendly', 'technical', 'educational']).default('professional').describe('Tone of the response'),
    user_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate').describe('User\'s experience level')
  }),
  execute: async (params) => {
    const {
      question,
      context,
      domain_focus,
      tone = 'professional',
      user_level = 'intermediate'
    } = params

    const apiKey = process.env.CHAINGPT_API_KEY
    if (!apiKey) {
      throw new Error('CHAINGPT_API_KEY is not set in environment variables')
    }

    try {
      const generalchat = new GeneralChat({
        apiKey: apiKey
      })

      // Construct enhanced prompt
      let enhancedQuestion = question
      if (context) {
        enhancedQuestion = `Context: ${context}\n\nQuestion: ${question}`
      }

      // Add domain focus
      if (domain_focus) {
        const domainInstructions = {
          defi: 'Focus on DeFi protocols, yield farming, and decentralized finance.',
          nft: 'Focus on NFT markets, collections, and digital assets.',
          trading: 'Focus on cryptocurrency trading and market analysis.',
          development: 'Focus on blockchain development and smart contracts.',
          security: 'Focus on Web3 security and best practices.',
          general_web3: 'Provide comprehensive Web3 knowledge.'
        }
        enhancedQuestion += `\n\nFocus: ${domainInstructions[domain_focus]}`
      }

      // Add user level context
      const levelContext = {
        beginner: 'Explain for Web3 beginners with clear, simple language.',
        intermediate: 'Provide balanced detail for someone with some Web3 experience.',
        advanced: 'Provide advanced insights and technical details.'
      }
      enhancedQuestion += `\n\nUser level: ${levelContext[user_level]}`

      // Get streaming response (simplified version without context injection)
      console.log('Making simplified streaming API call to ChainGPT...')
      const stream = await generalchat.createChatStream({
        question: enhancedQuestion,
        chatHistory: "off"
      })

      // Return stream metadata for the UI to handle
      return {
        stream_initiated: true,
        question: question,
        domain_focus,
        user_level,
        tone,
        timestamp: new Date().toISOString(),
        source: 'ChainGPT Web3 AI (Streaming)',
        enhanced_prompt: enhancedQuestion
      }

    } catch (error) {
      console.error('ChainGPT Web3 Agent streaming error:', error)
      
      return {
        stream_initiated: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        question: question,
        timestamp: new Date().toISOString(),
        source: 'ChainGPT Web3 AI (Streaming)'
      }
    }
  }
})

/**
 * Helper function to get chat history for a user session
 */
export const getChainGPTChatHistory = async (sessionId: string, limit: number = 10) => {
  const apiKey = process.env.CHAINGPT_API_KEY
  if (!apiKey) {
    throw new Error('CHAINGPT_API_KEY is not set in environment variables')
  }

  try {
    const generalchat = new GeneralChat({
      apiKey: apiKey
    })

    const response = await generalchat.getChatHistory({
      sdkUniqueId: sessionId,
      limit: limit,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "ASC"
    })

    return {
      history: response.data.rows,
      total: response.data.total,
      session_id: sessionId
    }
  } catch (error) {
    console.error('Error fetching ChainGPT chat history:', error)
    return {
      history: [],
      total: 0,
      session_id: sessionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

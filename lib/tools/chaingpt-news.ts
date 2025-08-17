import { tool } from 'ai'
import { z } from 'zod'

// ChainGPT News API types
interface ChainGPTNewsItem {
  id: number
  title: string
  description: string
  link: string
  category: string
  subCategory?: string
  tokenSymbol?: string
  publishedAt: string
  createdAt: string
  imageUrl?: string
}

interface ChainGPTNewsResponse {
  data: ChainGPTNewsItem[]
  total: number
  page: number
  limit: number
}

interface NewsFilters {
  categoryId?: number
  subCategoryId?: number
  tokenId?: number
  searchQuery?: string
  sortBy?: 'createdAt' | 'publishedAt'
  fetchAfter?: string
}

/**
 * Creates a ChainGPT news tool for fetching crypto and Web3 news
 */
export const chainGPTNewsTool = tool({
  description: 'Fetch contextually relevant crypto and Web3 news from ChainGPT AI News based on user intent',
  parameters: z.object({
    user_query: z.string().describe('The original user query to understand context and intent'),
    query: z.string().optional().describe('Processed search query to filter news articles'),
    limit: z.number().min(1).max(50).default(10).describe('Number of news articles to fetch (1-50)'),
    category: z.string().optional().describe('News category filter (e.g., "Bitcoin", "Ethereum", "DeFi")'),
    token_symbol: z.string().optional().describe('Specific token symbol to filter news (e.g., "BTC", "ETH")'),
    sort_by: z.enum(['createdAt', 'publishedAt']).default('createdAt').describe('Sort articles by creation or publication date'),
    include_images: z.boolean().default(true).describe('Include article images in the response'),
    news_type: z.enum(['trending', 'breaking', 'market_impact', 'general']).default('general').describe('Type of news to prioritize')
  }),
  execute: async (params) => {
    const {
      user_query,
      query,
      limit = 10,
      category,
      token_symbol,
      sort_by = 'createdAt',
      include_images = true,
      news_type = 'general'
    } = params

    // Intelligent query processing based on user intent
    let processedQuery = query
    let processedTokenSymbol = token_symbol
    let processedCategory = category

    // Analyze user query for context and intent
    const userQueryLower = user_query.toLowerCase()
    
    // Extract token symbols from user query
    if (!processedTokenSymbol) {
      const tokenMatches = userQueryLower.match(/\b(btc|bitcoin|eth|ethereum|ada|cardano|sol|solana|matic|polygon|avax|avalanche|dot|polkadot|link|chainlink|uni|uniswap|aave|comp|compound|mkr|maker|snx|synthetix|crv|curve|1inch|sushi|sushiswap|yfi|yearn|bal|balancer)\b/g)
      if (tokenMatches) {
        const tokenMap: { [key: string]: string } = {
          'bitcoin': 'BTC', 'btc': 'BTC',
          'ethereum': 'ETH', 'eth': 'ETH',
          'cardano': 'ADA', 'ada': 'ADA',
          'solana': 'SOL', 'sol': 'SOL',
          'polygon': 'MATIC', 'matic': 'MATIC',
          'avalanche': 'AVAX', 'avax': 'AVAX',
          'polkadot': 'DOT', 'dot': 'DOT',
          'chainlink': 'LINK', 'link': 'LINK',
          'uniswap': 'UNI', 'uni': 'UNI',
          'aave': 'AAVE',
          'compound': 'COMP', 'comp': 'COMP',
          'maker': 'MKR', 'mkr': 'MKR',
          'synthetix': 'SNX', 'snx': 'SNX',
          'curve': 'CRV', 'crv': 'CRV',
          '1inch': '1INCH',
          'sushiswap': 'SUSHI', 'sushi': 'SUSHI',
          'yearn': 'YFI', 'yfi': 'YFI',
          'balancer': 'BAL', 'bal': 'BAL'
        }
        processedTokenSymbol = tokenMap[tokenMatches[0]] || tokenMatches[0].toUpperCase()
      }
    }

    // Determine news type and search terms based on user intent
    if (!processedQuery) {
      if (userQueryLower.includes('trending') || userQueryLower.includes('popular') || userQueryLower.includes('hot')) {
        processedQuery = 'trending popular viral'
        news_type === 'general' && (params.news_type = 'trending')
      } else if (userQueryLower.includes('breaking') || userQueryLower.includes('urgent') || userQueryLower.includes('alert')) {
        processedQuery = 'breaking urgent important alert'
        news_type === 'general' && (params.news_type = 'breaking')
      } else if (userQueryLower.includes('impact') || userQueryLower.includes('price') || userQueryLower.includes('market')) {
        processedQuery = 'price impact market movement analysis'
        news_type === 'general' && (params.news_type = 'market_impact')
      } else if (userQueryLower.includes('defi') || userQueryLower.includes('yield') || userQueryLower.includes('farming')) {
        processedCategory = 'DeFi'
        processedQuery = 'defi yield farming protocol'
      } else if (userQueryLower.includes('nft') || userQueryLower.includes('collectible')) {
        processedCategory = 'NFT'
        processedQuery = 'nft collectible marketplace'
      } else if (userQueryLower.includes('regulation') || userQueryLower.includes('government') || userQueryLower.includes('sec')) {
        processedQuery = 'regulation government sec policy legal'
      } else if (userQueryLower.includes('adoption') || userQueryLower.includes('institutional')) {
        processedQuery = 'adoption institutional corporate enterprise'
      }
    }

    const apiKey = process.env.CHAINGPT_API_KEY
    if (!apiKey) {
      throw new Error('CHAINGPT_API_KEY is not set in environment variables')
    }

    try {
      // Try multiple API call strategies for better results
      let finalArticles: ChainGPTNewsItem[] = []
      let apiCallMade = false

      // Strategy 1: Try with both query and token symbol
      if (processedQuery && processedTokenSymbol) {
        const queryParams1 = new URLSearchParams({
          limit: limit.toString(),
          sortBy: sort_by,
          searchQuery: processedQuery,
          tokenSymbol: processedTokenSymbol.toUpperCase()
        })

        const response1 = await fetch(`https://api.chaingpt.org/news?${queryParams1.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (response1.ok) {
          const data1: ChainGPTNewsResponse = await response1.json()
          if (data1.data.length > 0) {
            finalArticles = data1.data
            apiCallMade = true
          }
        }
      }

      // Strategy 2: If no results, try with just token symbol
      if (!apiCallMade && processedTokenSymbol) {
        const queryParams2 = new URLSearchParams({
          limit: limit.toString(),
          sortBy: sort_by,
          tokenSymbol: processedTokenSymbol.toUpperCase()
        })

        const response2 = await fetch(`https://api.chaingpt.org/news?${queryParams2.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (response2.ok) {
          const data2: ChainGPTNewsResponse = await response2.json()
          if (data2.data.length > 0) {
            finalArticles = data2.data
            apiCallMade = true
          }
        }
      }

      // Strategy 3: If still no results, try with just search query
      if (!apiCallMade && processedQuery) {
        const queryParams3 = new URLSearchParams({
          limit: limit.toString(),
          sortBy: sort_by,
          searchQuery: processedQuery
        })

        const response3 = await fetch(`https://api.chaingpt.org/news?${queryParams3.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (response3.ok) {
          const data3: ChainGPTNewsResponse = await response3.json()
          if (data3.data.length > 0) {
            finalArticles = data3.data
            apiCallMade = true
          }
        }
      }

      // Strategy 4: Fallback to general news
      if (!apiCallMade) {
        const queryParams4 = new URLSearchParams({
          limit: limit.toString(),
          sortBy: sort_by
        })

        const response4 = await fetch(`https://api.chaingpt.org/news?${queryParams4.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (response4.ok) {
          const data4: ChainGPTNewsResponse = await response4.json()
          finalArticles = data4.data
          apiCallMade = true
        } else {
          const errorText = await response4.text()
          throw new Error(`ChainGPT API error: ${response4.status} ${response4.statusText} - ${errorText}`)
        }
      }

      // Process and format the news articles
      const processedArticles = finalArticles.map(article => ({
        id: article.id,
        title: article.title,
        description: article.description,
        url: article.link || null, // ChainGPT API doesn't provide external links for AI-generated news
        category: article.category,
        subCategory: article.subCategory,
        tokenSymbol: article.tokenSymbol,
        publishedAt: article.publishedAt,
        createdAt: article.createdAt,
        imageUrl: include_images ? article.imageUrl : undefined
      }))

      // Helper function to safely get string value from potentially complex objects
      const getStringValue = (value: any): string => {
        if (typeof value === 'string') return value.toLowerCase()
        if (typeof value === 'object' && value !== null) {
          return (value.name || value.symbol || value.title || String(value)).toLowerCase()
        }
        return String(value || '').toLowerCase()
      }

      // Apply client-side filtering for better relevance
      let filteredArticles = processedArticles

      // Filter by token if specified
      if (processedTokenSymbol) {
        const tokenSymbolLower = processedTokenSymbol.toLowerCase()
        const tokenFiltered = processedArticles.filter(article => {
          const tokenSymbol = getStringValue(article.tokenSymbol)
          const title = getStringValue(article.title)
          const description = getStringValue(article.description)
          
          return tokenSymbol === tokenSymbolLower ||
                 title.includes(tokenSymbolLower) ||
                 description.includes(tokenSymbolLower)
        })
        if (tokenFiltered.length > 0) {
          filteredArticles = tokenFiltered
        }
      }

      // Filter by category if specified
      if (processedCategory) {
        const categoryLower = processedCategory.toLowerCase()
        const categoryFiltered = filteredArticles.filter(article => {
          const category = getStringValue(article.category)
          const subCategory = getStringValue(article.subCategory)
          
          return category.includes(categoryLower) ||
                 subCategory.includes(categoryLower)
        })
        if (categoryFiltered.length > 0) {
          filteredArticles = categoryFiltered
        }
      }

      return {
        articles: filteredArticles,
        total: filteredArticles.length,
        query: processedQuery || processedTokenSymbol || 'latest crypto news',
        timestamp: new Date().toISOString(),
        source: 'ChainGPT AI News'
      }

    } catch (error) {
      console.error('ChainGPT News API error:', error)
      
      // Return empty result with error info instead of throwing
      return {
        articles: [],
        total: 0,
        query: query || 'latest crypto news',
        timestamp: new Date().toISOString(),
        source: 'ChainGPT AI News',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
})

/**
 * Intelligent news fetching with context understanding
 * This function analyzes user queries and fetches relevant news
 */
export async function fetchIntelligentNews(
  userQuery: string,
  limit: number = 10
) {
  // The AI model will automatically call the chainGPTNewsTool with intelligent parameters
  // based on the user's query context and intent
  return {
    message: 'Use the crypto_news tool directly through the AI model for intelligent news fetching',
    userQuery,
    limit
  }
}

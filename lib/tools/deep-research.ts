import { tool } from 'ai'
import { createHash } from 'crypto'
import https from 'https'
import { z } from 'zod'
import { getRedisClient } from '../redis/config'

export const deepResearchSchema = z.object({
  query: z.string().describe('A single comprehensive research query that covers ALL aspects the user wants researched. Do not make multiple calls - combine everything into one detailed research request.')
})

// Custom HTTPS request function with no timeouts
function makeHttpsRequest(url: string, options: any, data: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: {
        ...options.headers,
        'Content-Length': Buffer.byteLength(data, 'utf8')
      },
      // Completely disable all timeouts
      timeout: 0,
      // Additional Node.js specific timeout settings
      keepAlive: true,
      keepAliveMsecs: 0,
    }

    const req = https.request(requestOptions, (res) => {
      // No timeout on response
      res.setTimeout(0)
      
      let responseData = ''
      
      res.on('data', (chunk) => {
        responseData += chunk
      })
      
      res.on('end', () => {
        try {
          const result = {
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            statusText: res.statusMessage!,
            json: () => Promise.resolve(JSON.parse(responseData)),
            text: () => Promise.resolve(responseData)
          }
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      res.on('error', (error) => {
        reject(error)
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    // Disable all possible timeouts on the request
    req.setTimeout(0)
    req.on('timeout', () => {
      // This should never be called since timeout is 0, but just in case
      console.log('Request timeout occurred despite timeout being set to 0')
    })
    
    if (data) {
      req.write(data)
    }
    
    req.end()
  })
}

// Store for batching queries
interface PendingQuery {
  query: string
  timestamp: number
  resolve: (result: any) => void
  reject: (error: any) => void
}

let pendingQueries: PendingQuery[] = []
let batchTimeout: NodeJS.Timeout | null = null

// Generate a cache key for the query
function generateCacheKey(query: string): string {
  const hash = createHash('md5').update(query.toLowerCase().trim()).digest('hex')
  return `deep_research:${hash}`
}

// Cache the research response
async function cacheResearchResponse(query: string, response: any): Promise<void> {
  try {
    const redis = await getRedisClient()
    const cacheKey = generateCacheKey(query)
    
    const cacheData = {
      query,
      response: JSON.stringify(response),
      cached_at: new Date().toISOString(),
      cache_version: '2.0'
    }
    
    // Cache for 7 days (604800 seconds) for debugging purposes
    await redis.set(cacheKey, JSON.stringify(cacheData), { ex: 604800 })
    console.log(`Cached deep research response for query: ${query.substring(0, 50)}...`)
  } catch (error) {
    console.error('Failed to cache deep research response:', error)
    // Don't throw - caching failure shouldn't break the main functionality
  }
}

// Get cached research response
async function getCachedResearchResponse(query: string): Promise<any | null> {
  try {
    const redis = await getRedisClient()
    const cacheKey = generateCacheKey(query)
    
    const cachedData = await redis.get(cacheKey)
    if (cachedData) {
      const parsed = JSON.parse(cachedData)
      console.log(`Found cached deep research response for query: ${query.substring(0, 50)}... (cached at: ${parsed.cached_at})`)
      return JSON.parse(parsed.response)
    }
    
    return null
  } catch (error) {
    console.error('Failed to retrieve cached deep research response:', error)
    return null
  }
}

// Cache the raw API response for debugging
async function cacheRawApiResponse(query: string, rawResponse: any): Promise<void> {
  try {
    const redis = await getRedisClient()
    const hash = createHash('md5').update(query.toLowerCase().trim()).digest('hex')
    const cacheKey = `deep_research_raw:${hash}`
    
    const cacheData = {
      query,
      raw_response: JSON.stringify(rawResponse),
      cached_at: new Date().toISOString(),
      cache_version: '2.0'
    }
    
    // Cache for 7 days (604800 seconds) for debugging purposes
    await redis.set(cacheKey, JSON.stringify(cacheData), { ex: 604800 })
    console.log(`Cached RAW deep research response for query: ${query.substring(0, 50)}...`)
  } catch (error) {
    console.error('Failed to cache raw deep research response:', error)
    // Don't throw - caching failure shouldn't break the main functionality
  }
}

// Combine multiple queries into a single comprehensive research request
function combineQueries(queries: string[]): string {
  if (queries.length === 1) {
    return queries[0]
  }

  // Create a comprehensive research prompt that covers all aspects
  const uniqueQueries = [...new Set(queries)] // Remove duplicates
  
  return `Conduct comprehensive deep research covering the following related aspects:

${uniqueQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Please provide a unified, well-structured analysis that addresses all these aspects in a single comprehensive report. Include:
- Executive Summary covering all aspects
- Detailed analysis for each area
- Cross-connections and relationships between different aspects
- Consolidated findings and conclusions
- Comprehensive sources and citations

Ensure the response is cohesive and treats these as interconnected parts of a larger research topic rather than separate questions.`
}

// Process batched queries
async function processBatchedQueries(): Promise<void> {
  if (pendingQueries.length === 0) return

  const queries = pendingQueries.map(pq => pq.query)
  const resolvers = pendingQueries.map(pq => ({ resolve: pq.resolve, reject: pq.reject }))
  
  // Clear pending queries
  pendingQueries = []
  batchTimeout = null

  console.log(`Processing ${queries.length} batched deep research queries:`)
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q.substring(0, 80)}...`))

  try {
    // Combine all queries into one comprehensive research request
    const combinedQuery = combineQueries(queries)
    console.log(`Combined query: ${combinedQuery.substring(0, 200)}...`)

    // Check cache for combined query
    const cachedResponse = await getCachedResearchResponse(combinedQuery)
    if (cachedResponse) {
      const result = { ...cachedResponse, from_cache: true }
      // Resolve all pending promises with the same result
      resolvers.forEach(({ resolve }) => resolve(result))
      return
    }

    // Make single API call for all queries
    const result = await executeDeepResearchAPI(combinedQuery)
    
    // Resolve all pending promises with the same result
    resolvers.forEach(({ resolve }) => resolve(result))

  } catch (error) {
    console.error('Batched deep research error:', error)
    // Reject all pending promises with the same error
    resolvers.forEach(({ reject }) => reject(error))
  }
}

// Execute the actual Deep Research API call
async function executeDeepResearchAPI(query: string) {
  try {
    // Call OpenAI Deep Research API - no timeout, let it run as long as needed
    console.log('Making Deep Research API call (no timeout - allowing full processing time)...')
    
    const response = await makeHttpsRequest('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }, JSON.stringify({
      model: 'o4-mini-deep-research-2025-06-26',
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: 'You are an expert research analyst. Conduct comprehensive deep research on the given topic and provide a detailed, well-structured response with proper citations and sources.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: query
            }
          ]
        }
      ],
      reasoning: {
        summary: 'auto'
      },
      tools: [
        {
          type: 'web_search_preview'
        }
      ]
    }))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Deep Research API error:', response.status, errorText)
      throw new Error(`Deep Research API failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Deep Research API response received successfully')
    
    // Cache the raw API response for debugging
    await cacheRawApiResponse(query, data)

    // Try multiple extraction strategies to find the content
    let content = 'No content received from Deep Research API'
    let sources: any[] = []

    // Strategy 1: Look for message type with output_text (correct format)
    const messageOutput = data.output?.find((item: any) => 
      item.type === 'message' && 
      item.content?.[0]?.type === 'output_text' && 
      item.content?.[0]?.text
    )
    
    if (messageOutput?.content?.[0]?.text) {
      content = messageOutput.content[0].text
      // Extract citations from annotations
      const annotations = messageOutput.content[0].annotations || []
      sources = annotations.map((annotation: any, index: number) => ({
        url: annotation.url || `https://research.openai.com/source-${index + 1}`,
        title: annotation.title || `Research Source ${index + 1}`,
        description: `Citation from Deep Research API - chars ${annotation.start_index || 0}-${annotation.end_index || 0}`
      }))
      console.log(`Found message content: ${content.length} characters, ${sources.length} sources`)
    }

    // Strategy 2: Fallback - Look for any text type output
    if (content === 'No content received from Deep Research API') {
      const textOutput = data.output?.find((item: any) => item.type === 'text' && item.content?.[0]?.text)
      if (textOutput?.content?.[0]?.text) {
        content = textOutput.content[0].text
        console.log('Found fallback text content:', content.length, 'characters')
      }
    }

    // Strategy 3: Look for any content with text field
    if (content === 'No content received from Deep Research API') {
      const textOutputs = data.output?.filter((item: any) => item.content) || []
      for (const textOutput of textOutputs) {
        if (textOutput.content && Array.isArray(textOutput.content)) {
          for (const contentItem of textOutput.content) {
            if (contentItem.text) {
              content = contentItem.text
              console.log('Found alternative text content:', content.length, 'characters')
              break
            }
          }
        }
        if (content !== 'No content received from Deep Research API') break
      }
    }

    // Extract debug information
    const reasoningSteps = data.output?.filter((item: any) => item.type === 'reasoning') || []
    const webSearches = data.output?.filter((item: any) => item.type === 'web_search_call' || item.type === 'web_search_preview') || []

    console.log(`Content extraction result: ${content.length} characters extracted`)
    console.log(`Found ${sources.length} sources, ${reasoningSteps.length} reasoning steps, ${webSearches.length} web searches`)

    const result = {
      type: 'deep_research_result',
      query: query,
      content: content,
      sources: sources,
      model_used: 'o4-mini-deep-research-2025-06-26',
      timestamp: new Date().toISOString(),
      from_cache: false,
      debug_info: {
        reasoning_steps: reasoningSteps.length,
        web_searches: webSearches.length,
        total_output_items: data.output?.length || 0
      }
    }

    // Cache the successful response
    await cacheResearchResponse(query, result)
    return result

  } catch (error) {
    console.error('Deep Research API call failed:', error)
    
    // Return a graceful error response instead of throwing
    const errorMessage = `The Deep Research API is currently unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`

    console.log('Returning graceful error response to user')
    
    return {
      type: 'deep_research_result',
      query: query,
      content: `# Deep Research Currently Unavailable

I apologize, but the OpenAI Deep Research API is currently experiencing issues and cannot complete your research request.

**Error Details:**
${errorMessage}

**What you can do:**
1. **Try again in a few minutes** - The service may be experiencing temporary high load
2. **Simplify your query** - More specific, focused questions may work better
3. **Use alternative research** - I can help with general analysis using my existing knowledge

**Your original query was:** "${query}"

Would you like me to provide some general insights on this topic using my existing knowledge instead?`,
      sources: [],
      model_used: 'error-fallback',
      timestamp: new Date().toISOString(),
      from_cache: false,
      debug_info: {
        reasoning_steps: 0,
        web_searches: 0,
        total_output_items: 0,
        error: errorMessage
      }
    }
  }
}

export const deepResearchTool = tool({
  description: `CRITICAL USAGE PATTERN - Follow this EXACT flow to prevent UI issues:

1. **FIRST**: If the user's query needs clarification, ask questions in NATURAL LANGUAGE (not using any tools)
2. **WAIT**: For the user to respond in natural language with clarifications  
3. **THEN**: Make ONE comprehensive deep_research call incorporating all requirements

**DO NOT**:
- Make multiple calls to this tool
- Use ask_question tool (removed) - use natural language instead
- Call this tool before getting necessary clarifications

**DO**:
- Ask clarifying questions in natural language first
- Combine ALL research aspects into ONE comprehensive query
- Include complete context: "Comprehensive analysis of [topic] including [aspect1], [aspect2], [aspect3], etc."

This tool conducts expensive, time-intensive deep research with real web search capabilities. The natural language → single tool call pattern prevents UI refresh issues during long operations.

Example good query: "Comprehensive analysis of Kodiak Finance yield strategies including risk assessment, historical performance, competitive analysis, and strategic recommendations for 2025"`,
  parameters: deepResearchSchema,
  execute: async ({ query }) => {
    try {
      console.log('Deep Research requested for query:', query)
      
      // Check cache first for this specific query
      const cachedResponse = await getCachedResearchResponse(query)
      if (cachedResponse) {
        console.log('Returning cached response for query:', query.substring(0, 50))
        return {
          ...cachedResponse,
          from_cache: true
        }
      }
      
      // Add query to pending batch
      return new Promise((resolve, reject) => {
        pendingQueries.push({
          query,
          timestamp: Date.now(),
          resolve,
          reject
        })

        console.log(`Added query to batch (${pendingQueries.length} total). Will process in 1 second...`)

        // If this is the first query, start the batch timer
        if (batchTimeout === null) {
          batchTimeout = setTimeout(() => {
            processBatchedQueries()
          }, 1000) // Reduced to 1 second for faster single queries
        }
      })

    } catch (error) {
      console.error('Deep research error:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Deep research request timed out after 10 minutes. The research query may be too complex.')
      }
      throw new Error(`Deep research failed: ${error}`)
    }
  }
}) 
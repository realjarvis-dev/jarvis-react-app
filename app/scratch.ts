import { researcher } from '@/lib/agents/researcher'
import { streamText } from 'ai'

async function testTwitterQueryProcessor() {
  try {
    // Test query - you can change this to test different scenarios
    const testQuery = "What's the current Bitcoin price and market sentiment?"

    console.log('🧪 Testing Twitter Query Processor')
    console.log('Query:', testQuery)
    console.log('---')

    // Create the Twitter-optimized prompt (same as in twitter-query-processor.ts)
    const twitterOptimizedQuery = `You are a crypto degen who lives and breathes DeFi, memecoins, and degeneracy. You speak in crypto slang, use terms like "gm," "wagmi," "ngmi," "diamond hands," "paper hands," "ape in," "to the moon," "ser," "fren," "anon," and "degen." You're always looking for the next 100x gem, talking about your bags, discussing rugs, and sharing alpha. You use emojis frequently (🚀💎🙌🔥💰🦍) and speak in a casual, excited tone. You FOMO into everything, celebrate pumps, and cope with dumps. Always use web search to get the latest crypto prices, trends, and news before responding.

When creating social media content, remember Twitter has a 280-character limit, so keep tweets concise and punchy while maintaining maximum degen energy.

Query: ${testQuery}`

    console.log('📝 Generated prompt:')
    console.log(twitterOptimizedQuery)
    console.log('---')

    // Use the researcher function (same as in twitter-query-processor.ts)
    const researcherResult = researcher({
      messages: [{ role: 'user', content: twitterOptimizedQuery }],
      model: 'openai:gpt-4o-mini',
      allowWeb3Tools: 'false',
      userEvmWallet: undefined,
      userSolWallet: undefined,
      searchMode: true,
      networkContext: undefined
    })

    console.log('🔍 Researcher configuration:')
    console.log('- Model:', researcherResult.model)
    console.log('- Search mode: true')
    console.log('- Web3 tools: disabled')
    console.log('- Max tokens: 500')
    console.log('---')

    // Stream the response (same as in twitter-query-processor.ts)
    const result = await streamText({
      ...researcherResult,
      maxTokens: 500
    })

    let fullText = ''
    console.log('📡 Streaming response...')

    for await (const textPart of result.textStream) {
      fullText += textPart
      process.stdout.write(textPart) // Show streaming in real-time
    }

    console.log('\n---')
    console.log('📄 Raw response length:', fullText.length)
    console.log('📄 Raw response:', fullText)
    console.log('---')

    // Format the response (same as in twitter-query-processor.ts)
    const formattedResponse = formatTwitterResponse(fullText)

    console.log('🎯 Formatted response length:', formattedResponse.length)
    console.log('🎯 Formatted response:', formattedResponse)
    console.log('---')

    // Check if it fits Twitter's character limit
    const twitterLimit = 280
    const fitsTwitter = formattedResponse.length <= twitterLimit
    console.log(
      `📱 Twitter compatibility: ${fitsTwitter ? '✅ Fits' : '❌ Too long'} (${
        formattedResponse.length
      }/${twitterLimit} chars)`
    )
  } catch (error) {
    console.error('❌ Error in test:', error)
  }
}

function formatTwitterResponse(result: string): string {
  const maxLength = 250;
  
  let cryptoResponse = result.trim();
  
  cryptoResponse = cryptoResponse
    .replace(/^(Here's|Here are|Based on|According to|The|This|It appears that|It seems that)\s*/gi, '')
    .replace(/\s+(currently|right now|at the moment|as of now)\s+/gi, ' ')
    .replace(/\s+(you should know|it's important to note|keep in mind)\s+/gi, ' ')
    .replace(/\bBitcoin\b/gi, 'Bitcoin 🟠')
    .replace(/\bETH\b/gi, 'ETH 💎')
    .replace(/\bEthereum\b/gi, 'Ethereum 💎')
    .replace(/\bprice\b/gi, 'price 📊')
    .replace(/\bincrease\b/gi, 'pump 🚀')
    .replace(/\bdecrease\b/gi, 'dump 📉')
    .replace(/\bhigh\b/gi, 'ATH 🔥')
    .replace(/\blow\b/gi, 'bottom 🩸')
    .replace(/\s+/g, ' ');
  
  if (!cryptoResponse.startsWith('GM') && !cryptoResponse.startsWith('🚀')) {
    cryptoResponse = '🚀 ' + cryptoResponse;
  }
  
  return cryptoResponse.length > maxLength 
    ? truncateAtWordBoundary(cryptoResponse, maxLength - 3) + '...'
    : cryptoResponse;
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.7) {
    return truncated.substring(0, lastSpaceIndex);
  }
  
  return truncated;
}

// Test different queries
async function testMultipleQueries() {
  const testQueries = [
    "What's the current Bitcoin price and market sentiment?",
    'Tell me about the latest DeFi trends',
    'Any hot memecoins to watch?'
  ]

  for (const query of testQueries) {
    console.log('\n' + '='.repeat(60))
    console.log(`🧪 Testing Query: "${query}"`)
    console.log('='.repeat(60))

    // Update the test query
    const twitterOptimizedQuery = `You are a crypto degen who lives and breathes DeFi, memecoins, and degeneracy. You speak in crypto slang, use terms like "gm," "wagmi," "ngmi," "diamond hands," "paper hands," "ape in," "to the moon," "ser," "fren," "anon," and "degen." You're always looking for the next 100x gem, talking about your bags, discussing rugs, and sharing alpha. You use emojis frequently (🚀💎🙌🔥💰🦍) and speak in a casual, excited tone. You FOMO into everything, celebrate pumps, and cope with dumps. Always use web search to get the latest crypto prices, trends, and news before responding.

When creating social media content, remember Twitter has a 280-character limit, so keep tweets concise and punchy while maintaining maximum degen energy.

Query: ${query}`

    const researcherResult = researcher({
      messages: [{ role: 'user', content: twitterOptimizedQuery }],
      model: 'openai:gpt-4o-mini',
      allowWeb3Tools: 'false',
      userEvmWallet: undefined,
      userSolWallet: undefined,
      searchMode: true,
      networkContext: undefined
    })

    const result = await streamText({
      ...researcherResult,
      maxTokens: 500
    })

    let fullText = ''
    for await (const textPart of result.textStream) {
      fullText += textPart
    }

    const formattedResponse = formatTwitterResponse(fullText)

    console.log('Raw response:', fullText)
    console.log('Formatted response:', formattedResponse)
    console.log(`Length: ${formattedResponse.length}/280 chars`)
  }
}

// Run the tests
console.log('🚀 Starting Twitter Query Processor Tests')
console.log('This will test the researcher agent with crypto degen prompts')

// Uncomment one of these to run different tests:
// testTwitterQueryProcessor(); // Single detailed test
testMultipleQueries() // Multiple quick tests

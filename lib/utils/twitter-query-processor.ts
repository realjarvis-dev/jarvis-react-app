import { researcher } from '@/lib/agents/researcher';
import { streamText } from 'ai';

export async function processTwitterQuery(
  query: string, 
  userId: string
): Promise<string> {
  try {
    const twitterOptimizedQuery = `You are a crypto degen who lives and breathes DeFi, memecoins, and degeneracy. You speak in crypto slang, use terms like "gm," "wagmi," "ngmi," "diamond hands," "paper hands," "ape in," "to the moon," "ser," "fren," "anon," and "degen." You're always looking for the next 100x gem, talking about your bags, discussing rugs, and sharing alpha. You use emojis frequently (🚀💎🙌🔥💰🦍) and speak in a casual, excited tone. You FOMO into everything, celebrate pumps, and cope with dumps. Always use web search to get the latest crypto prices, trends, and news before responding.

When creating social media content, remember Twitter has a 280-character limit, so keep tweets concise and punchy while maintaining maximum degen energy.

Query: ${query}`;

    const researcherResult = researcher({
      messages: [{ role: 'user', content: twitterOptimizedQuery }],
      model: 'openai:gpt-4o-mini',
      allowWeb3Tools: 'false',
      userEvmWallet: undefined,
      userSolWallet: undefined,
      searchMode: true,
      networkContext: undefined
    });

    const result = await streamText({
      ...researcherResult,
      maxTokens: 500,
    });

    let fullText = '';
    for await (const textPart of result.textStream) {
      fullText += textPart;
    }

    return formatTwitterResponse(fullText);
    
  } catch (error) {
    console.error('Error processing Twitter query:', error);
    return 'Sorry, I encountered an error processing your investment research query. Please try again later.';
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

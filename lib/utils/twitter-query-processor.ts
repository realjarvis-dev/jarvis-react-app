import { researcher } from '@/lib/agents/researcher';
import { streamText } from 'ai';

export async function processTwitterQuery(
  query: string, 
  userId: string
): Promise<string> {
  try {
    const researcherResult = researcher({
      messages: [{ role: 'user', content: query }],
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
  
  let cryptoResponse = result;
  
  cryptoResponse = cryptoResponse
    .replace(/\bBitcoin\b/gi, 'Bitcoin 🟠')
    .replace(/\bETH\b/gi, 'ETH 💎')
    .replace(/\bEthereum\b/gi, 'Ethereum 💎')
    .replace(/\bprice\b/gi, 'price 📊')
    .replace(/\bincrease\b/gi, 'pump 🚀')
    .replace(/\bdecrease\b/gi, 'dump 📉')
    .replace(/\bhigh\b/gi, 'ATH 🔥')
    .replace(/\blow\b/gi, 'bottom 🩸');
  
  if (!cryptoResponse.startsWith('GM') && !cryptoResponse.startsWith('🚀')) {
    cryptoResponse = '🚀 ' + cryptoResponse;
  }
  
  return cryptoResponse.length > maxLength 
    ? cryptoResponse.substring(0, maxLength - 3) + '...'
    : cryptoResponse;
}

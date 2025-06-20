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
  
  return result.length > maxLength 
    ? result.substring(0, maxLength - 3) + '...'
    : result;
}

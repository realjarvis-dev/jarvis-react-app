import { getModel } from '@/lib/utils/registry';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// Schema for the wallet analysis output
export const WalletAnalysisSchema = z.object({
  userPersona: z.object({
    riskProfile: z.enum(['conservative', 'moderate', 'aggressive', 'degen']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
  
  behavioralPatterns: z.object({
    tradingFrequency: z.enum(['infrequent', 'regular', 'active', 'high_frequency']),
    transactionCategory: z.enum(['micro', 'small', 'medium', 'large', 'whale']),
    averageTransactionSize: z.object({
      eth: z.number(),
      usd_estimate: z.number()
    })
  }),

  protocolPreferences: z.object({
    topProtocols: z.array(z.object({
      name: z.string(),
      frequency: z.number(),
      category: z.enum(['defi', 'nft', 'bridge', 'other'])
    })),
    defiCategories: z.array(z.enum(['lending', 'dex', 'yield_farming', 'derivatives', 'staking']))
  }),

  portfolioInsights: z.object({
    primaryAssets: z.array(z.string()),
    activityPattern: z.enum(['accumulator', 'trader', 'yield_farmer', 'experimenter'])
  }),

  summary: z.string(),
  
  actionableRecommendations: z.array(z.object({
    category: z.enum(['RISK_MANAGEMENT', 'OPPORTUNITY', 'OPTIMIZATION', 'EDUCATION', 'DIVERSIFICATION']),
    recommendation: z.string()
  }))
});

export type WalletAnalysis = z.infer<typeof WalletAnalysisSchema>;

interface EnrichedTransaction {
  hash: string;
  from: string;
  to: string;
  value: number;
  asset: string;
  timestamp: string;
  fromAddressType: 'wallet' | 'contract';
  toAddressType: 'wallet' | 'contract';
  toContractName?: string;
  fromContractName?: string;
  transactionDetails?: {
    gasUsed: string;
    status: number;
    effectiveGasPrice: string;
  };
  functionCall?: {
    functionName: string;
    functionSignature: string;
    decodedParams?: any;
  };
}

/**
 * Analyze wallet behavior from enriched transaction data using LLM
 */
export async function analyzeWalletBehavior(
  enrichedTransactions: EnrichedTransaction[],
  walletAddress: string,
  options: {
    model?: string;
  } = {}
): Promise<WalletAnalysis> {
  const { model = 'openai:gpt-4o' } = options;
  
  if (enrichedTransactions.length === 0) {
    throw new Error('No transactions provided for analysis');
  }

  const systemPrompt = `You are an expert DeFi behavioral analyst. Analyze the complete list of enriched transactions for this wallet and provide detailed behavioral insights for investment recommendations.

ANALYSIS REQUIREMENTS:
1. userPersona: Determine risk profile (conservative/moderate/aggressive/degen) with confidence level and detailed reasoning
2. behavioralPatterns: Trading frequency, transaction category (micro/small/medium/large/whale), and average transaction sizes
3. protocolPreferences: Top protocols used and DeFi categories engaged with
4. portfolioInsights: Primary assets and overall activity pattern
5. summary: Comprehensive behavioral analysis combining key insights and user's DeFi behavior patterns (DO NOT mention wallet addresses)
6. actionableRecommendations: 3-5 specific recommendations with categories

TRANSACTION CATEGORIES:
- micro: <0.01 ETH
- small: 0.01-0.1 ETH  
- medium: 0.1-1 ETH
- large: 1-10 ETH
- whale: >10 ETH

RECOMMENDATION CATEGORIES:
- RISK_MANAGEMENT: Risk mitigation strategies
- OPPORTUNITY: New investment opportunities
- OPTIMIZATION: Efficiency improvements
- EDUCATION: Learning opportunities
- DIVERSIFICATION: Portfolio expansion strategies

GUIDELINES:
- Conservative: Established protocols, consistent patterns, low experimentation
- Moderate: Mix of established and newer protocols, measured risk-taking  
- Aggressive: Higher frequency, larger positions, multiple protocols
- Degen: New/risky protocols, high experimentation, FOMO behavior

Provide comprehensive behavioral analysis with actionable investment insights.`;

  const userPrompt = `Analyze this wallet's complete transaction history:

WALLET: ${walletAddress}
TOTAL TRANSACTIONS: ${enrichedTransactions.length}

COMPLETE ENRICHED TRANSACTIONS:
${JSON.stringify(enrichedTransactions, null, 2)}

Provide detailed behavioral analysis in the required JSON format.`;

  try {
    // Use structured output with the complete transaction data
    const result = await generateObject({
      model: getModel(model),
      schema: WalletAnalysisSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3,
    });

    return result.object;
  } catch (error) {
    console.warn('Structured generation failed, falling back to text generation:', error);
    
    // Fallback to text generation with manual parsing
    try {
      const textResult = await generateText({
        model: getModel(model),
        system: systemPrompt,
        prompt: userPrompt + '\n\nRespond ONLY with valid JSON matching the required schema.',
        temperature: 0.3,
      });

      const parsed = JSON.parse(textResult.text);
      const validated = WalletAnalysisSchema.parse(parsed);
      return validated;
    } catch (fallbackError) {
      console.error('Both structured and text generation failed:', fallbackError);
      
      // Return a minimal valid response as last resort
      return {
        userPersona: {
          riskProfile: 'moderate',
          confidence: 0.5,
          reasoning: 'Unable to analyze due to processing error'
        },
        behavioralPatterns: {
          tradingFrequency: 'regular',
          transactionCategory: 'medium',
          averageTransactionSize: {
            eth: 0.001,
            usd_estimate: 2
          },
        },
        protocolPreferences: {
          topProtocols: [],
          defiCategories: ['dex'],
        },
        portfolioInsights: {
          primaryAssets: ['ETH'],
          activityPattern: 'experimenter',
        },
        summary: 'Analysis could not be completed due to processing error. Basic transaction data is available.',
        actionableRecommendations: []
      };
    }
  }
} 
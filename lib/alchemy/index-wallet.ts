import { getUserEvmWalletAddress } from '@/lib/privy/client';
import {
    getCompleteWalletIntelligence,
    saveWalletSummary
} from './transfers-sdk';
import { WalletAnalysis } from './wallet-indexing-llm';

export interface WalletIndexingResult {
  success: boolean;
  walletAddress?: string;
  analysis?: WalletAnalysis;
  processingStats?: {
    totalTransactions: number;
    pagesProcessed: number;
    analysisTime: number;
    enrichmentTime: number;
  };
  error?: string;
}

export interface WalletIndexingOptions {
  fromBlock?: string;
  maxPages?: number;
  maxConcurrency?: number;
  analysisModel?: string;
  skipSaving?: boolean;
}

/**
 * Complete wallet indexing pipeline: 
 * 1. Get user's wallet address
 * 2. Fetch all transactions (both from and to)
 * 3. Enrich transactions with metadata
 * 4. Analyze with LLM for behavioral insights
 * 5. Save summary to Redis
 */
export async function indexUserWallet(
  options: WalletIndexingOptions = {}
): Promise<WalletIndexingResult> {
  const {
    fromBlock = '0x0',
    maxPages = 5,
    maxConcurrency = 3,
    analysisModel = 'openai:gpt-4o',
    skipSaving = false
  } = options;

  try {
    const walletAddress = await getUserEvmWalletAddress();
    
    if (!walletAddress) {
      return {
        success: false,
        error: 'User does not have an Ethereum wallet'
      };
    }

    const intelligence = await getCompleteWalletIntelligence(walletAddress, {
      fromBlock,
      maxPages,
      maxConcurrency,
      analysisModel
    });

    if (!skipSaving) {
      try {
        await saveWalletSummary(walletAddress, intelligence.behavioralAnalysis);
      } catch (saveError) {
        console.warn('Failed to save wallet summary to Redis:', saveError);
      }
    }

    return {
      success: true,
      walletAddress,
      analysis: intelligence.behavioralAnalysis,
      processingStats: intelligence.processingStats
    };

  } catch (error) {
    console.error('Wallet indexing failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during wallet indexing'
    };
  }
} 
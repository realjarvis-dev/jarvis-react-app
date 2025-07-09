import { getUserEvmWalletAddress } from '@/lib/privy/client';
import {
    enrichAllTransfersForAddress,
    getCompleteWalletIntelligence,
    saveWalletSummary
} from './transfers-sdk';
import { analyzeWalletBehavior, WalletAnalysis } from './wallet-indexing-llm';

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
  additionalWallet?: string;
}

/**
 * Complete wallet indexing pipeline: 
 * 1. Get user's wallet address
 * 2. Fetch all transactions (both from and to) for main wallet and optional additional wallet
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
    skipSaving = false,
    additionalWallet
  } = options;

  try {
    const walletAddress = await getUserEvmWalletAddress();
    
    if (!walletAddress) {
      return {
        success: false,
        error: 'User does not have an Ethereum wallet'
      };
    }

    // If additional wallet is provided, combine transactions from both wallets
    if (additionalWallet && additionalWallet.trim()) {
      console.log(`Indexing main wallet ${walletAddress} with additional wallet ${additionalWallet}`);
      
      const enrichmentStartTime = Date.now();
      
      // Fetch transactions from both wallets
      const [mainWalletResults, additionalWalletResults] = await Promise.all([
        enrichAllTransfersForAddress(
          walletAddress,
          fromBlock,
          { maxCount: 20 },
          undefined,
          maxConcurrency,
          Math.ceil(maxPages / 2) // Split pages between wallets
        ),
        enrichAllTransfersForAddress(
          additionalWallet.trim(),
          fromBlock,
          { maxCount: 20 },
          undefined,
          maxConcurrency,
          Math.ceil(maxPages / 2)
        )
      ]);

      const enrichmentTime = Date.now() - enrichmentStartTime;
      
      // Combine all transactions
      const allTransactions = [
        ...mainWalletResults.allTransfers,
        ...additionalWalletResults.allTransfers
      ];
      
      const totalTransactions = mainWalletResults.totalCount + additionalWalletResults.totalCount;
      const totalPages = mainWalletResults.pagesProcessed + additionalWalletResults.pagesProcessed;

      if (allTransactions.length === 0) {
        return {
          success: false,
          error: 'No transactions found for analysis in either wallet'
        };
      }

      console.log(`Analyzing ${allTransactions.length} combined transactions from both wallets...`);
      const analysisStartTime = Date.now();

      // Analyze combined transactions as if they belong to one user
      const behavioralAnalysis = await analyzeWalletBehavior(
        allTransactions, 
        walletAddress, // Use main wallet as the primary identifier
        { model: analysisModel }
      );

      const analysisTime = Date.now() - analysisStartTime;

      if (!skipSaving) {
        try {
          await saveWalletSummary(walletAddress, behavioralAnalysis);
        } catch (saveError) {
          console.warn('Failed to save wallet summary to Redis:', saveError);
        }
      }

      return {
        success: true,
        walletAddress,
        analysis: behavioralAnalysis,
        processingStats: {
          totalTransactions,
          pagesProcessed: totalPages,
          analysisTime,
          enrichmentTime
        }
      };
    } else {
      // Single wallet analysis (existing functionality)
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
    }

  } catch (error) {
    console.error('Wallet indexing failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during wallet indexing'
    };
  }
} 
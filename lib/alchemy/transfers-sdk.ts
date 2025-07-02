import { Alchemy, AssetTransfersCategory, AssetTransfersParams, AssetTransfersResponse, Network } from "alchemy-sdk";
import {
  AlchemyTransfersConfig
} from './types';
import { decodeFunction, fetchContractName, getAddressType } from './utils';
import { analyzeWalletBehavior, WalletAnalysis } from './wallet-indexing-llm';

/**
 * Create an Alchemy instance with the given configuration
 */
function createAlchemyInstance(config?: AlchemyTransfersConfig): Alchemy {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error('Alchemy API key is required. Set ALCHEMY_API_KEY environment variable.');
  }
  
  const network = config?.network || Network.ETH_MAINNET;
  
  return new Alchemy({
    apiKey,
    network
  });
}

/**
 * Get asset transfers for a given set of parameters
 */
export async function getAssetTransfers(
  params: AssetTransfersParams,
  config?: AlchemyTransfersConfig
): Promise<AssetTransfersResponse> {
  const alchemy = createAlchemyInstance(config);
  return await alchemy.core.getAssetTransfers(params);
}

/**
 * Get transfers TO a specific address
 */
export async function getTransfersToAddress(
  toAddress: string,
  fromBlock: string = "0x0",
  additionalParams?: Partial<AssetTransfersParams>,
  config?: AlchemyTransfersConfig
): Promise<AssetTransfersResponse> {
  const { category, ...otherParams } = additionalParams || {};
  
  const params: AssetTransfersParams = {
    fromBlock,
    toAddress,
    category: category || [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL, AssetTransfersCategory.ERC20, AssetTransfersCategory.ERC721, AssetTransfersCategory.ERC1155],
    ...otherParams
  };
  
  return getAssetTransfers(params, config);
}

/**
 * Get transfers FROM a specific address
 */
export async function getTransfersFromAddress(
  fromAddress: string,
  fromBlock: string = "0x0",
  additionalParams?: Partial<AssetTransfersParams>,
  config?: AlchemyTransfersConfig
): Promise<AssetTransfersResponse> {
  const { category, ...otherParams } = additionalParams || {};
  
  const params: AssetTransfersParams = {
    fromBlock,
    fromAddress,
    category: category || [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.INTERNAL, AssetTransfersCategory.ERC20, AssetTransfersCategory.ERC721, AssetTransfersCategory.ERC1155],
    ...otherParams
  };
  
  return getAssetTransfers(params, config);
}

/**
 * Get all transfers for a specific address (both incoming and outgoing)
 */
export async function getAllTransfersForAddress(
  address: string,
  fromBlock: string = "0x0",
  additionalParams?: Partial<AssetTransfersParams>,
  config?: AlchemyTransfersConfig
): Promise<{ incoming: AssetTransfersResponse; outgoing: AssetTransfersResponse }> {
  const [incoming, outgoing] = await Promise.all([
    getTransfersToAddress(address, fromBlock, additionalParams, config),
    getTransfersFromAddress(address, fromBlock, additionalParams, config)
  ]);

  return { incoming, outgoing };
}

/**
 * Enrich a single transaction with additional metadata
 */
export async function enrichTransaction(
  transaction: any,
  config?: AlchemyTransfersConfig
): Promise<any> {
  const alchemy = createAlchemyInstance(config);
  
  try {
    const enrichedTx = { ...transaction };
    
    // Get block timestamp if we have blockNum
    if (transaction.blockNum) {
      try {
        const block = await alchemy.core.getBlock(parseInt(transaction.blockNum, 16));
        enrichedTx.timestamp = block?.timestamp ? new Date(block.timestamp * 1000).toISOString() : null;
      } catch (error) {
        enrichedTx.timestamp = null;
      }
    }

    // Get transaction details if we have hash
    if (transaction.hash) {
      try {
        const txReceipt = await alchemy.core.getTransactionReceipt(transaction.hash);
        enrichedTx.transactionDetails = {
          gasUsed: txReceipt?.gasUsed?.toString(),
          status: txReceipt?.status,
          effectiveGasPrice: txReceipt?.effectiveGasPrice?.toString()
        };
      } catch (error) {
        enrichedTx.transactionDetails = null;
      }
    }

    // Enrich 'from' address
    if (transaction.from) {
      try {
        const fromType = await getAddressType(transaction.from, alchemy);
        enrichedTx.fromAddressType = fromType;
        
        if (fromType === 'contract') {
          const contractName = await fetchContractName(transaction.from);
          enrichedTx.fromContractName = contractName;
        }
      } catch (error) {
        enrichedTx.fromAddressType = 'unknown';
      }
    }

    // Enrich 'to' address
    if (transaction.to) {
      try {
        const toType = await getAddressType(transaction.to, alchemy);
        enrichedTx.toAddressType = toType;
        
        if (toType === 'contract') {
          const contractName = await fetchContractName(transaction.to);
          enrichedTx.toContractName = contractName;
        }
      } catch (error) {
        enrichedTx.toAddressType = 'unknown';
      }
    }

    // Decode function call if there's input data
    if (transaction.to && transaction.rawContract?.rawValue) {
      try {
        // For asset transfers, the input might be in rawContract.rawValue
        // We need to get the actual transaction to get the input data
        if (transaction.hash) {
          const fullTx = await alchemy.core.getTransaction(transaction.hash);
          if (fullTx?.data && fullTx.data !== '0x') {
            const functionDecoding = await decodeFunction(transaction.to, fullTx.data);
            enrichedTx.functionCall = functionDecoding;
          }
        }
      } catch (error) {
        enrichedTx.functionCall = null;
      }
    }

    // Try to get transaction traces (if available on free tier)
    if (transaction.hash) {
      try {
        // Note: This might not work on free tier, but we'll try
        // Transaction tracing is often not available on free tier, so we'll skip this
        enrichedTx.traces = null; // Placeholder - traces not available on free tier
      } catch (error) {
        // Transaction tracing might not be available on free tier
        enrichedTx.traces = null;
      }
    }

    return enrichedTx;
    
  } catch (error) {
    // Return original transaction with error info if enrichment fails
    return {
      ...transaction,
      enrichmentError: error instanceof Error ? error.message : 'Unknown enrichment error'
    };
  }
}

/**
 * Enrich all transfers in a response
 */
export async function enrichAllTransfers(
  transfersResponse: AssetTransfersResponse,
  config?: AlchemyTransfersConfig,
  maxConcurrency: number = 5
): Promise<any[]> {
  const { transfers } = transfersResponse;
  
  if (transfers.length === 0) {
    return [];
  }

  console.log(`🔍 Enriching ${transfers.length} transfers...`);
  
  // Process transfers in batches to avoid overwhelming APIs
  const enrichedTransfers: any[] = [];
  
  for (let i = 0; i < transfers.length; i += maxConcurrency) {
    const batch = transfers.slice(i, i + maxConcurrency);
    console.log(`📊 Processing batch ${Math.floor(i / maxConcurrency) + 1}/${Math.ceil(transfers.length / maxConcurrency)} (${batch.length} transfers)`);
    
    const enrichedBatch = await Promise.all(
      batch.map(transfer => enrichTransaction(transfer, config))
    );
    
    enrichedTransfers.push(...enrichedBatch);
  }
  
  console.log(`✅ Successfully enriched ${enrichedTransfers.length} transfers`);
  return enrichedTransfers;
}

/**
 * Recursively fetch and enrich ALL transfers for an address with pagination
 */
export async function enrichAllTransfersForAddress(
  address: string,
  direction: 'from' | 'to' | 'both' = 'both',
  fromBlock: string = "0x0",
  additionalParams?: Partial<AssetTransfersParams>,
  config?: AlchemyTransfersConfig,
  maxConcurrency: number = 5,
  maxPages: number = 10
): Promise<{
  allTransfers: any[];
  totalCount: number;
  pagesProcessed: number;
  fromTransfers?: any[];
  toTransfers?: any[];
}> {
  console.log(`🚀 Starting comprehensive enrichment for address: ${address}`);
  console.log(`📋 Direction: ${direction}, Max pages: ${maxPages}, Concurrency: ${maxConcurrency}`);
  
  if (direction === 'both') {
    console.log('🔄 Processing both incoming and outgoing transfers...');
    
    const [fromResults, toResults] = await Promise.all([
      enrichAllTransfersForAddress(address, 'from', fromBlock, additionalParams, config, maxConcurrency, maxPages),
      enrichAllTransfersForAddress(address, 'to', fromBlock, additionalParams, config, maxConcurrency, maxPages)
    ]);
    
    return {
      allTransfers: [...fromResults.allTransfers, ...toResults.allTransfers],
      totalCount: fromResults.totalCount + toResults.totalCount,
      pagesProcessed: fromResults.pagesProcessed + toResults.pagesProcessed,
      fromTransfers: fromResults.allTransfers,
      toTransfers: toResults.allTransfers
    };
  }
  
  // Single direction processing
  const allEnrichedTransfers: any[] = [];
  let pageKey: string | undefined;
  let pagesProcessed = 0;
  
  const fetchFunction = direction === 'from' ? getTransfersFromAddress : getTransfersToAddress;
  
  do {
    try {
      console.log(`📖 Fetching page ${pagesProcessed + 1} for ${direction} transfers...`);
      
      const params = {
        ...additionalParams,
        pageKey
      };
      
      const transfersResponse = await fetchFunction(address, fromBlock, params, config);
      
      if (transfersResponse.transfers.length === 0) {
        console.log('📝 No more transfers found');
        break;
      }
      
      console.log(`📦 Found ${transfersResponse.transfers.length} transfers on page ${pagesProcessed + 1}`);
      
      // Enrich all transfers in this page
      const enrichedTransfers = await enrichAllTransfers(transfersResponse, config, maxConcurrency);
      allEnrichedTransfers.push(...enrichedTransfers);
      
      pageKey = transfersResponse.pageKey;
      pagesProcessed++;
      
      console.log(`✅ Page ${pagesProcessed} complete. Total enriched: ${allEnrichedTransfers.length}`);
      
      // Safety check to avoid infinite loops
      if (pagesProcessed >= maxPages) {
        console.log(`⚠️ Reached maximum pages limit (${maxPages}). Stopping pagination.`);
        break;
      }
      
    } catch (error) {
      console.error(`❌ Error processing page ${pagesProcessed + 1}:`, error);
      break;
    }
    
  } while (pageKey);
  
  console.log(`🎉 Completed enrichment: ${allEnrichedTransfers.length} total transfers across ${pagesProcessed} pages`);
  
  return {
    allTransfers: allEnrichedTransfers,
    totalCount: allEnrichedTransfers.length,
    pagesProcessed
  };
}

/**
 * Complete wallet intelligence: Fetch, enrich, and analyze ALL transactions for behavioral insights
 */
export async function getCompleteWalletIntelligence(
  address: string,
  options: {
    direction?: 'from' | 'to' | 'both';
    fromBlock?: string;
    maxPages?: number;
    maxConcurrency?: number;
    analysisModel?: string;
  } = {}
): Promise<{
  enrichedTransactions: any[];
  behavioralAnalysis: WalletAnalysis;
  processingStats: {
    totalTransactions: number;
    pagesProcessed: number;
    analysisTime: number;
    enrichmentTime: number;
  };
}> {
  const {
    direction = 'both',
    fromBlock = '0x0',
    maxPages = 5,
    maxConcurrency = 3,
    analysisModel = 'openai:gpt-4o'
  } = options;

  console.log(`Starting complete wallet intelligence for: ${address}`);
  console.log(`Parameters: direction=${direction}, maxPages=${maxPages}, model=${analysisModel}`);

  const enrichmentStartTime = Date.now();

  // Step 1: Fetch and enrich all transactions
  const enrichmentResults = await enrichAllTransfersForAddress(
    address,
    direction,
    fromBlock,
    { maxCount: 20 }, // 20 per page for thorough analysis
    undefined,
    maxConcurrency,
    maxPages
  );

  const enrichmentTime = Date.now() - enrichmentStartTime;
  console.log(`Enrichment completed in ${enrichmentTime}ms`);

  if (enrichmentResults.allTransfers.length === 0) {
    throw new Error('No transactions found for analysis');
  }

  console.log(`Analyzing ${enrichmentResults.allTransfers.length} enriched transactions...`);
  const analysisStartTime = Date.now();

  // Step 2: Generate behavioral analysis
  const behavioralAnalysis = await analyzeWalletBehavior(
    enrichmentResults.allTransfers, 
    address, 
    { model: analysisModel }
  );

  const analysisTime = Date.now() - analysisStartTime;
  console.log(`Analysis completed in ${analysisTime}ms`);

  // Step 3: Return comprehensive results
  return {
    enrichedTransactions: enrichmentResults.allTransfers,
    behavioralAnalysis,
    processingStats: {
      totalTransactions: enrichmentResults.totalCount,
      pagesProcessed: enrichmentResults.pagesProcessed,
      analysisTime,
      enrichmentTime
    }
  };
}

/**
 * Main function to test the complete wallet intelligence system
 */
async function main() {
  try {
    const testAddress = '0xe852Bb2b0d981a4e869c6e642678CD95298681Bb';
    
    console.log('TESTING COMPLETE WALLET INTELLIGENCE SYSTEM\n');
    console.log('=' .repeat(60));

    // Test 1: Basic functionality
    console.log('\nTEST 1: Basic Transfer Fetching');
    const transfers = await getTransfersFromAddress(testAddress, '0x0', { maxCount: 3 });
    console.log(`Found ${transfers.transfers.length} transfers`);

    // Test 2: Single enrichment
    console.log('\nTEST 2: Single Transaction Enrichment');
    if (transfers.transfers.length > 0) {
      const enriched = await enrichTransaction(transfers.transfers[0]);
      const newFields = Object.keys(enriched).filter(key => 
        !Object.keys(transfers.transfers[0]).includes(key)
      );
      console.log(`Added enrichment fields: ${newFields.join(', ')}`);
    }

    // Test 3: Complete wallet intelligence
    console.log('\nTEST 3: Complete Wallet Intelligence (AI Analysis)');
    console.log('This combines enrichment + LLM behavioral analysis...\n');
    
    const intelligence = await getCompleteWalletIntelligence(testAddress, {
      direction: 'from',
      maxPages: 2,
      maxConcurrency: 2,
      analysisModel: 'openai:gpt-4o-mini' // Use mini for faster testing
    });

    // Display results
    console.log('\nCOMPLETE WALLET INTELLIGENCE RESULTS:');
    console.log('=' .repeat(60));
    
    console.log('\nPROCESSING STATS:');
    console.log(`  Total transactions: ${intelligence.processingStats.totalTransactions}`);
    console.log(`  Pages processed: ${intelligence.processingStats.pagesProcessed}`);
    console.log(`  Enrichment time: ${intelligence.processingStats.enrichmentTime}ms`);
    console.log(`  Analysis time: ${intelligence.processingStats.analysisTime}ms`);

    console.log('\nBEHAVIORAL ANALYSIS:');
    console.log(`  Risk Profile: ${intelligence.behavioralAnalysis.userPersona.riskProfile} (${Math.round(intelligence.behavioralAnalysis.userPersona.confidence * 100)}% confidence)`);
    console.log(`  Reasoning: ${intelligence.behavioralAnalysis.userPersona.reasoning}`);
    console.log(`  Trading Frequency: ${intelligence.behavioralAnalysis.behavioralPatterns.tradingFrequency}`);
    console.log(`  Transaction Category: ${intelligence.behavioralAnalysis.behavioralPatterns.transactionCategory}`);
    console.log(`  Avg Transaction: ${intelligence.behavioralAnalysis.behavioralPatterns.averageTransactionSize.eth} ETH (~$${intelligence.behavioralAnalysis.behavioralPatterns.averageTransactionSize.usd_estimate})`);
    console.log(`  Activity Pattern: ${intelligence.behavioralAnalysis.portfolioInsights.activityPattern}`);
    console.log(`  Primary Assets: ${intelligence.behavioralAnalysis.portfolioInsights.primaryAssets.join(', ')}`);

    console.log('\nPROTOCOL PREFERENCES:');
    intelligence.behavioralAnalysis.protocolPreferences.topProtocols.forEach((protocol, index) => {
      console.log(`  ${index + 1}. ${protocol.name} (${protocol.category}, ${protocol.frequency} uses)`);
    });
    
    console.log('\nDEFI CATEGORIES:');
    console.log(`  ${intelligence.behavioralAnalysis.protocolPreferences.defiCategories.join(', ')}`);

    console.log('\nSUMMARY:');
    console.log(`  "${intelligence.behavioralAnalysis.summary}"`);

    console.log('\nACTIONABLE RECOMMENDATIONS:');
    intelligence.behavioralAnalysis.actionableRecommendations.forEach((rec, index) => {
      console.log(`  [${rec.category}] ${rec.recommendation}`);
    });

    console.log('\nComplete wallet intelligence test completed successfully!');
    
  } catch (error) {
    console.error('Error in wallet intelligence test:', error);
  }
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}
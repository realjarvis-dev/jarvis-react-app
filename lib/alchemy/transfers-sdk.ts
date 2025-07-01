import { Alchemy, AssetTransfersCategory, AssetTransfersParams, AssetTransfersResponse, Network } from "alchemy-sdk";
import {
    AlchemyTransfersConfig
} from './types';

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
 * Main function to test the transfers SDK
 */
async function main() {
  try {
    console.log('🔍 Fetching transfers from address: 0xe852Bb2b0d981a4e869c6e642678CD95298681Bb');
    
    const transfers = await getTransfersFromAddress(
      '0xe852Bb2b0d981a4e869c6e642678CD95298681Bb',
      '0x0',
      { maxCount: 10 } // Limit to 10 transfers for testing
    );
    
    console.log('✅ Found transfers:', JSON.stringify(transfers, null, 2));
    console.log(`📊 Total transfers found: ${transfers.transfers.length}`);
    
    if (transfers.transfers.length > 0) {
      console.log('🔢 Sample transfer:', transfers.transfers[0]);
    }
    
  } catch (error) {
    console.error('❌ Error fetching transfers:', error);
  }
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}
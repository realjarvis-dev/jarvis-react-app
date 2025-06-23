const fs = require('fs');
const path = require('path');
const attachmentPaths = {
  "1": "/home/ubuntu/attachments/731d79dc-e6d7-42cc-8896-08f042acaee0/pendle_1.json",
  "56": "/home/ubuntu/attachments/dcac7723-e450-410d-b9d9-3946aae01534/pendle_56.json", 
  "42161": "/home/ubuntu/attachments/8a39ffc7-7e6e-49fa-9482-f413c3f97ad8/pendle_42161.json",
  "5000": "/home/ubuntu/attachments/372b48ae-5ac1-4945-8be5-e739eaaa4405/pendle_5000.json",
  "8453": "/home/ubuntu/attachments/fc85709e-5c77-4311-b639-6510cadcb7b9/pendle_8453.json",
  "80094": "/home/ubuntu/attachments/9f81ca1a-074a-4b84-bc91-8268c39c34b8/pendle_80094.json",
  "146": "/home/ubuntu/attachments/01dea965-af2f-483b-a268-a2255ee6e99f/pendle_146.json"
};

function cleanAddress(address) {
  if (typeof address !== 'string') return address;
  return address.startsWith('1-') ? address.substring(2) : 
         address.startsWith('56-') ? address.substring(3) :
         address.startsWith('42161-') ? address.substring(6) :
         address.startsWith('5000-') ? address.substring(5) :
         address.startsWith('8453-') ? address.substring(5) :
         address.startsWith('80094-') ? address.substring(6) :
         address.startsWith('146-') ? address.substring(4) :
         address;
}

function formatExpiry(expiry) {
  const date = new Date(expiry);
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}
const baseUrl = 'https://api-v2.pendle.finance/core'

async function generateTokens() {
  const allTokens = {};
  
  for (const [chainId, filePath] of Object.entries(attachmentPaths)) {
    allTokens[chainId] = [];
    
    try {
      // if (!fs.existsSync(filePath)) {
      //   console.log(`File not found: ${filePath}`);
      //   continue;
      // }
      //
      const response = await fetch(`${baseUrl}/v1/${chainId}/markets/inactive`)
      const data = await response.json()

      console.log(data)
      
      // const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      for (const market of data.markets) {
        const expiryFormatted = formatExpiry(market.expiry);
        const ptAddress = cleanAddress(market.pt);
        const ytAddress = cleanAddress(market.yt);
        const syAddress = cleanAddress(market.sy);
        const underlyingAddress = cleanAddress(market.underlyingAsset);
        
        allTokens[chainId].push({
          chainId: parseInt(chainId),
          address: ptAddress,
          symbol: `PT-${market.name}-${expiryFormatted}`,
          name: `PT ${market.name} ${expiryFormatted}`,
          decimals: 18,
          tokenType: "pt",
          marketAddress: market.address,
          expiry: market.expiry,
          underlyingAsset: underlyingAddress
        });
        
        allTokens[chainId].push({
          chainId: parseInt(chainId),
          address: ytAddress,
          symbol: `YT-${market.name}-${expiryFormatted}`,
          name: `YT ${market.name} ${expiryFormatted}`,
          decimals: 18,
          tokenType: "yt",
          marketAddress: market.address,
          expiry: market.expiry,
          underlyingAsset: underlyingAddress
        });
        
        allTokens[chainId].push({
          chainId: parseInt(chainId),
          address: syAddress,
          symbol: `SY-${market.name}`,
          name: `SY ${market.name}`,
          decimals: 18,
          tokenType: "sy",
          marketAddress: market.address,
          expiry: market.expiry,
          underlyingAsset: underlyingAddress
        });
      }
      
      console.log(`Processed ${data.markets.length} markets for chain ${chainId}, generated ${allTokens[chainId].length} tokens`);
    } catch (error) {
      console.error(`Error processing chain ${chainId}:`, error.message);
    }
  }
  
  const output = `
export interface PendleToken {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
  tokenType: 'pt' | 'yt' | 'sy'
  marketAddress: string
  expiry: string
  underlyingAsset: string
}
export const pendleInactiveTokensByChain: Record<string, PendleToken[]> = ${JSON.stringify(allTokens, null, 2)};
`;
  
  const outputPath = path.join(__dirname, '../lib/token-matcher/config/pendle/inactive-tokens.ts');
  fs.writeFileSync(outputPath, output);
  console.log(`Generated tokens file: ${outputPath}`);
  
  let totalTokens = 0;
  for (const [chainId, tokens] of Object.entries(allTokens)) {
    totalTokens += tokens.length;
    console.log(`Chain ${chainId}: ${tokens.length} tokens`);
  }
  console.log(`Total tokens generated: ${totalTokens}`);
}

generateTokens();
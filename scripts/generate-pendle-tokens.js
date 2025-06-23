const fs = require('fs');
const path = require('path');

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
      const response = await fetch(`${baseUrl}/v1/${chainId}/markets/active`)
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
  
  const output = `export interface PendleToken {
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

export const pendleTokensByChain: Record<string, PendleToken[]> = ${JSON.stringify(allTokens, null, 2)};
`;
  
  const outputPath = path.join(__dirname, '../lib/token-matcher/config/pendle/tokens.ts');
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

import { ethers } from "ethers";
import { TokenData } from "./types";
import { TENDERLY_DEMO_CONFIG } from "@/lib/network/config";

const commonlyUsedTokens = {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
    UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    AAVE: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    MKR: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
    COMP: '0xc00e94cb662c3520282e6f5717214004a7f26888'
}

export const commonlyUsedTokensArray = Object.values(commonlyUsedTokens)
export const commonlyUsedPTTokensArray = ['0xfc66d247f577bfc87df8a5267c43676c4a088b8b', 
    '0xeead826151d25f44418553303f2722893f08478c', 
    '0xa28194de3de7166ee81c2e13c864b9c7cca1b8ef', 
    '0xf696fe29ef85e892b5926313897d178288faa07e', 
    '0x742b4166878bfd339db65a29a17e49b81a6b6aac', 
    '0x933b9ffee0ad3ef8e4dbb52688ea905826d73755', 
    '0xe2828b5f839bd8bb4168eea4583375727e825058', 
    '0xab365c0879024481e4ad3b47bd6fea9c10014fbc', 
    '0x1132065009850c72e27b7950c0f9285d1d103589', 
    '0xd1d0ff7bb555f57a9604ce06bca704ab97a0049a',
    "0xb7de5dfcb74d25c2f21841fbd6230355c50d9308",
    "0xda57abf95a7c21eb9df08fbaada182f749f6c62f",
  "0x9db057e02582d1ceaec287be9861fbe25cecc765", "0xa36ecca8b7624d224f01cd6649c8afad3da12c3d",
  "0x4d7356369273c6373e6c5074fe540cb070acfe6b", "0xeead826151d25f44418553303f2722893f08478c",
  "0x613b5ebcea88a64d484ff91347073c153a4d3aa4", "0x18c11b1dc74cab82ad18d5034fde93fe90a41d99",
  "0x048680f64d6dff1748ba6d9a01f578433787e24b", "0xf696fe29ef85e892b5926313897d178288faa07e",
  "0xead01319c2ab0dc2c690eff5dfc5f465cd38fc87", "0x52453825c287ddef62d647ce51c0979d27c461f7",
  "0xa77c0de4d26b7c97d1d42abd6733201206122e25", "0x933b9ffee0ad3ef8e4dbb52688ea905826d73755",
  "0x42e2ba2bab73650442f0624297190fab219bb5d5", "0xfcaae839cfc7e3627741bd9914f661fd75cc3cbf",
  "0xbaa5aed0afd90390f00b1915744ad7e3296fb880", "0xa28194de3de7166ee81c2e13c864b9c7cca1b8ef",
  "0xa3d827d2604b547d1858e3cdc11707c27930d142", "0x338e2cafa81e72ff422983e124e265eeccd718cb",
  "0x55f06992e4c3ed17df830da37644885c0c34edda", "0x742b4166878bfd339db65a29a17e49b81a6b6aac",
  "0xf2ad4ec58033be97ec3f4f61b660156fb38ecb30", "0xa004dd9439c2cf00794786c9662267bee6d9f723",
  "0x47306e3cb4e325042556864b38aa0cbe8d928be5"
  ]


const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function decimals() view returns (uint8)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];
  
  // Helper function to get token data including balance
  export async function getDemoTokenData(tokenAddress: string, walletAddress: string, provider: ethers.JsonRpcProvider): Promise<TokenData | null> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Get token info and balance in parallel
      const [balance, symbol, name, decimals] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.symbol().catch(() => "UNKNOWN"),
        tokenContract.name().catch(() => "Unknown Token"),
        tokenContract.decimals().catch(() => 18)
      ]);
      
      // Only return tokens with positive balance
      if (balance > 0) {
        const formattedBalance = ethers.formatUnits(balance, decimals);
        // console.log(decimals)
        // console.log(Number(decimals))
        return {
          address: tokenAddress,
          symbol,
          name,
          balance: formattedBalance,
          network: TENDERLY_DEMO_CONFIG.displayName,
          decimals: Number(decimals)
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching data for token ${tokenAddress}:`);
      return null;
    }
  }
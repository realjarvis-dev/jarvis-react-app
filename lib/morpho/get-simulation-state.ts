// import { createPublicClient, http} from 'viem';
// import { mainnet } from 'viem/chains';
// import { MarketId, addresses, } from '@morpho-org/blue-sdk';
// import { Time } from '@morpho-org/morpho-ts';
// import { blueAbi, fetchPosition, fetchToken, fetchVault, fetchUser, fetchHolding, fetchMarket } from "@morpho-org/blue-sdk-viem";
// import { MarketParams } from '@morpho-org/blue-sdk-viem/lib/augment/MarketParams';
// import { Market } from '@morpho-org/blue-sdk-viem/lib/augment/Market';

// async function getBlueMarket(rpcUrl: string, marketId: MarketId, chainId: number) {
//   const { morpho } = addresses[chainId as keyof typeof addresses];
//   const client = createPublicClient({
//     chain: mainnet,
//     transport: http(rpcUrl),
//   });
//   const blockNumber = await client.getBlockNumber()
//   const feeRecipient = await client.readContract({
//     address: morpho,
//     blockNumber: blockNumber,
//     abi: blueAbi,
//     functionName: 'feeRecipient',
//     args: []
//     }) as `0x${string}`;
//   console.log("Block Number", blockNumber)
//   console.log("Fee Recipient", feeRecipient)


//   const mid = marketId as MarketId;

//   // (Optional) fetch immutable config like collateral/loan tokens, oracle, IRM, LLTV
//   const params = await MarketParams.fetch(mid, client);
//   console.log('Loan token:', params.loanToken);
//   console.log('Collateral token:', params.collateralToken);
//   console.log('Oracle:', params.oracle);
//   console.log('LLTV:', params.lltv.toString());

//   // Fetch the full market (includes dynamic state)
//   const market = await Market.fetch(mid, client);

//   // You now have a Morpho Blue SDK Market object:
//   console.log('Utilization (WAD):', market.utilization.toString());
//   console.log('Liquidity (loan units):', market.liquidity.toString());

//   // You can accrue interest to “now”
//   const accrued = market.accrueInterest(Time.timestamp());
//   console.log('Accrued utilization:', accrued.utilization.toString());

//   return market;
// }

// // Example usage:
// getBlueMarket('http://localhost:8545', '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc' as MarketId, 1)
//   .then((m) => {
//     // use `m` in your simulation state builder
//   })
//   .catch(console.error);
import {
  createPublicClient,
  http,
} from "viem";
import { mainnet } from 'viem/chains';
import {
  fetchMarket,
  fetchUser,
  fetchToken,
  fetchPosition,
  fetchHolding,
  blueAbi,
} from "@morpho-org/blue-sdk-viem";
import { MarketId, addresses, Position, User, Token, Holding, Market, Address } from '@morpho-org/blue-sdk';
import { InputSimulationState, MinimalBlock } from "@morpho-org/simulation-sdk";
// adapt these if your chain is not mainnet
const CHAIN = mainnet;
const CHAIN_ID = 1 as const; // number literal for mainnet

// interface MinimalBlock {
//   number: bigint;
//   hash?: `0x${string}`;
//   timestamp?: number;
//   baseFeePerGas?: bigint;
//   // add others if your SimulatedState expects more
// }

// export interface InputSimulationState {
//   chainId: number;
//   block: MinimalBlock;
//   global?: {
//     feeRecipient?: Address;
//   };
//   markets?: Record<MarketId, Market>;
//   users?: Record<Address, User>;
//   tokens?: Record<Address, Token>;
//   vaults?: Record<Address, any>; // placeholder, you can tighten this
//   positions?: Record<Address, Record<MarketId, Position>>;
//   holdings?: Record<Address, Record<Address, Holding>>;
//   vaultMarketConfigs?: Record<Address, Record<MarketId, any>>; // placeholder
//   vaultUsers?: Record<Address, Record<Address, any>>; // placeholder
// }

/**
 * Builds a simulated state for one user + one market.
 */
export async function buildSimulatedState(
  marketId: MarketId,
  userAddresses: Address[],
  chainId: number,
  rpcUrl: string
): Promise<InputSimulationState> {
  const client = createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl),
  });
  const { morpho } = addresses[chainId as keyof typeof addresses];


  // 1. Fetch latest block
  const rawBlock = await client.getBlock(); // latest
  const block: MinimalBlock = {
    number: rawBlock.number,
    timestamp: rawBlock.timestamp ?? undefined,
  };
  const feeRecipient = await client.readContract({
    address: morpho,
    blockNumber: rawBlock.number,
    abi: blueAbi,
    functionName: 'feeRecipient',
    args: []
    }) as `0x${string}`;
  // 2. Parallel fetch market, user, position
  const market = await fetchMarket(marketId, client, { deployless: true }).catch((e) => {
    throw new Error(`fetchMarket failed: ${String(e)}`);
  });

  const users: Record<Address, User> = {};
  const userPositions: Record<Address, Record<MarketId, Position>> = {};

  await Promise.all(
    userAddresses.map(async (userAddress) => {
      try {
        const user = await fetchUser(userAddress, client);
        users[userAddress] = user;
      } catch (e) {
        console.warn(`fetchUser failed for ${userAddress}: ${String(e)}`);
      }
      try {
        const position = await fetchPosition(userAddress, marketId, client);
        if (!userPositions[userAddress]) userPositions[userAddress] = {};
        userPositions[userAddress][marketId] = position;
      } catch (e) {
        // position might not exist; handle accordingly
        console.warn(`fetchPosition for ${userAddress} failed: ${String(e)}`);
      }
    })
  );

  // 3. Determine relevant token(s) to fetch.
  // This assumes the market object contains an underlying token address; adjust field names as needed.
  const tokenAddresses = new Set<Address>();
  tokenAddresses.add(market.params.collateralToken)
  tokenAddresses.add(market.params.loanToken)


  // Always include any token referenced in the position if available
  // (e.g., collateral or borrowed token, adjust based on Position shape)
  // For demonstration, assume position has a field like .token or .marketToken
  for (const userAddress of userAddresses) {
    const position = userPositions[userAddress]?.[marketId];
    if (position && (position as any).token) {
      tokenAddresses.add((position as any).token as Address);
    }
  }

  // 4. Fetch tokens in parallel
  const tokens: Record<Address, Token> = {};
  await Promise.all(
    Array.from(tokenAddresses).map(async (addr) => {
      try {
        const tok = await fetchToken(addr, client, { deployless: true });
        tokens[addr] = tok;
      } catch (e) {
        console.warn(`fetchToken(${addr}) failed: ${String(e)}`);
      }
    })
  );

  // 5. Fetch holdings for the user for each token we know about
  const holdings: Record<Address, Record<Address, Holding>> = {};
  await Promise.all(
    userAddresses.map(async (userAddress) => {
      const holdingsByToken: Record<Address, Holding> = {};
      await Promise.all(
        Object.keys(tokens).map(async (tokAddr) => {
          try {
            const holding = await fetchHolding(userAddress, tokAddr as Address, client);
            holdingsByToken[tokAddr as Address] = holding as unknown as Holding;
          } catch (e) {
            console.warn(`fetchHolding for user ${userAddress} and token ${tokAddr} failed: ${String(e)}`);
          }
        }),
      );
      if (Object.keys(holdingsByToken).length > 0) {
        holdings[userAddress] = holdingsByToken;
      }
    })
  );

  // 6. Assemble positions and holdings structures - This is now done earlier

  // 7. Compose final simulated state
  const simulatedState: InputSimulationState = {
    chainId: CHAIN_ID,
    block,
    global: {
      feeRecipient: feeRecipient,
    },
    markets: {
      [marketId]: market,
    },
    users: users,
    tokens,
    vaults: {}, // placeholder: populate when you have fetchers
    positions: userPositions,
    holdings,
    vaultMarketConfigs: {},
    vaultUsers: {},
  };

  return simulatedState;
}


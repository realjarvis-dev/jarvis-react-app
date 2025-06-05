// Address of the Kodiak Island Router
export const KODIAK_ROUTER_ADDRESS = '0x679a7C63FC83b6A4D9C1F931891d705483d4791F';

// Import the full Kodiak Router ABI
import KodiakRouterJson from './KodiakRouter.json';
export const KODIAK_ROUTER_FULL_ABI = KodiakRouterJson;

// ABI for ERC20 tokens for approvals
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

// Simple ABI for the Island contract's functions
export const ISLAND_ABI = [
  'function getMintAmounts(uint256 amount0Max, uint256 amount1Max) external view returns (uint256 amount0, uint256 amount1, uint256 mintAmount)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function name() view returns (string)',
  'function lowerTick() view returns (int24)',
  'function upperTick() view returns (int24)',
  'function pool() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function manager() view returns (address)',
  'function isManaged() view returns (bool)',
  'function managerFeeBPS() view returns (uint16)',
  'function getUnderlyingBalances() view returns (uint256 amount0Current, uint256 amount1Current)'
];

// ABI for pool contract
export const POOL_ABI = [
  'function fee() view returns (uint24)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

// ABI for factory contract
export const FACTORY_ABI = [
  'function numIslands() view returns (uint256)',
  'function getDeployers() view returns (address[])',
  'function getIslands(address deployer) view returns (address[])'
];

// Minimal ABIs for specific operations
export const TOKEN_INFO_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

export const ISLAND_INFO_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

// Bault-related ABIs and addresses
export const BAULT_ABI = [
  'function bounty() external view returns (uint256)',
  'function earned() external view returns (uint256)',
  'function previewClaimBgtWrapper(address wrapper) external view returns (uint256)',
  'function stakingToken() external view returns (address)',
  'function claimBgt(address recipient, uint256 minAmountOut) external returns (uint256)',
  'function claimBgtWrapper(address wrapper, address recipient, uint256 minAmountOut) external returns (uint256)'
];

export const BOUNTY_HELPER_ABI = [
  `function claimBgtWrapper(
    address bault,
    address bgtWrapper,
    address swapTarget,
    bytes calldata swapData,
    uint256 wrapperAmount,
    address bountyReceiver
  ) external`
];

// BGT Wrapper addresses (replace with actual addresses)
export const IBGT_ADDRESS = '0xac03caba51e17c86c921e1f6cbfbdc91f8bb2e6b';
export const YBGT_ADDRESS = '0x...'; // Add YBGT address
export const LBGT_ADDRESS = '0x...'; // Add LBGT address

// BountyHelper contract address (replace with actual address)
export const BOUNTY_HELPER_ADDRESS = '0x...'; // Add BountyHelper address 
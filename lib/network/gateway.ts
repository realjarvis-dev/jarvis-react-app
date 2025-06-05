import type { NextApiRequest } from 'next'
import { allNetworkConfigs, getActiveNetworkConfig } from './config'
import { ChainType, NetworkConfig } from './types'

const USER_SELECTED_NETWORK_COOKIE_KEY = 'user_selected_network'

/**
 * Retrieves the network configurationเหมาะสม on the server-side based on user preference (cookie) and demo mode.
 *
 * @param req - The Next.js API request object, used to access cookies.
 * @param serverSideIsDemoMode - Optional. Explicitly sets the demo mode for server-side logic. Defaults to false.
 * @returns The determined NetworkConfig object.
 */
export function getServerSideNetworkConfig(
  req: NextApiRequest,
  serverSideIsDemoMode: boolean = false
): NetworkConfig {
  let selectedChain: ChainType = 'ethereum' // Default chain

  // Try to get user's selected chain from cookie
  const cookies = req.cookies
  const cookieValue = cookies[USER_SELECTED_NETWORK_COOKIE_KEY]

  if (cookieValue && Object.keys(allNetworkConfigs).includes(cookieValue)) {
    selectedChain = cookieValue as ChainType
  } else {
    // If cookie is not set, or invalid, selectedChain remains 'ethereum' (our default)
    // Optionally, you could log a warning here if an invalid cookie value is found.
  }

  // Determine the effective demo mode for this server-side context
  // If selectedChain is forced to 'ethereum' due to serverSideIsDemoMode being true,
  // getActiveNetworkConfig will handle returning the demo config.
  const activeConfig = getActiveNetworkConfig(
    serverSideIsDemoMode,
    selectedChain
  )

  return activeConfig
}

// Example of how this might be used in an API route:
/*
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSideNetworkConfig } from '@/lib/network/gateway';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const networkConfig = getServerSideNetworkConfig(req);
  // Now use networkConfig for backend logic, e.g., initializing a provider
  res.status(200).json({ networkName: networkConfig.displayName, chainId: networkConfig.chainId });
}
*/

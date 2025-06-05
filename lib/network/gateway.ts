import { allNetworkConfigs, getActiveNetworkConfig } from './config'
import { ChainType, NetworkConfig, USER_SELECTED_NETWORK_COOKIE_KEY, USER_DEMO_MODE_COOKIE_KEY } from './types'
import { cookies } from 'next/headers'


/**
 * Retrieves the network configurationเหมาะสม on the server-side based on user preference (cookie) and demo mode.
 *
 * @param req - The Next.js API request object, used to access cookies.
 * @returns The determined NetworkConfig object.
 */
export async function getServerSideNetworkConfig(): Promise<NetworkConfig> {
  let selectedChain: ChainType = 'ethereum' // Default chain

  // Try to get user's selected chain from cookie
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(USER_SELECTED_NETWORK_COOKIE_KEY)?.value

  if (cookieValue && Object.keys(allNetworkConfigs).includes(cookieValue)) {
    selectedChain = cookieValue as ChainType
  } else {
    // If cookie is not set, or invalid, selectedChain remains 'ethereum' (our default)
    // Optionally, you could log a warning here if an invalid cookie value is found.
  }

  // Determine the effective demo mode for this server-side context
  // If selectedChain is forced to 'ethereum' due to serverSideIsDemoMode being true,
  // getActiveNetworkConfig will handle returning the demo config.
  const serverSideIsDemoMode = cookieStore.get(USER_DEMO_MODE_COOKIE_KEY)?.value === 'true'
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

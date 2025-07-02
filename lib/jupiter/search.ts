import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'

// Create a new axios instance for Jupiter API with its own cache
const jupiterAxios = axios.create()
const cachedJupiterAxios = setupCache(jupiterAxios, {
  ttl: 10 * 60 * 1000, // 10 minutes cache
  interpretHeader: false, // Don't use cache-control headers
  methods: ['get'] // Only cache GET requests
})

/**
 * Search for token metadata via Jupiter's Token API v2
 * @param mintAddress - Mint address
 * @returns Array of token metadata objects
 */
export async function searchTokens(mintAddress: string) {
  try {
    const response = await cachedJupiterAxios.get(
      'https://lite-api.jup.ag/tokens/v2/search',
      {
        params: { query: mintAddress }
      }
    )
    return response.data
  } catch (error) {
    console.error('Error fetching token metadata:', error)
    throw error
  }
}

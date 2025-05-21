import { tool } from 'ai';
import { z } from 'zod';
import { getKodiakOpportunities } from '../kodiak/api';

/**
 * Tool for fetching Kodiak Islands opportunities
 */
export const kodiakOpportunitiesTool = tool({
  description: 'Get Kodiak Islands yield opportunities on Ethereum or Berachain.',
  parameters: z.object({
    num_results: z
      .number()
      .min(-1)
      .max(100)
      .default(10)
      .describe('Number of opportunities to return (default 10). Use -1 to return all available opportunities.'),
    apr_gte: z
      .number()
      .optional()
      .describe(
        'Minimum APR in percentage (e.g., 5 for 5%). Filters for APR >= value/100. Optional.'
      ),
    apr_lte: z
      .number()
      .optional()
      .describe(
        'Maximum APR in percentage (e.g., 30 for 30%). Filters for APR <= value/100. Optional.'
      ),
    network: z
      .enum(['mainnet', 'bepolia'])
      .default('mainnet')
      .describe('Network to fetch opportunities from. Default is mainnet (Ethereum).')
  }),
  execute: async ({ num_results = 10, apr_gte, apr_lte, network = 'mainnet' }) => {
    try {
      // Get all opportunities from Kodiak
      const allOpportunities = await getKodiakOpportunities(network);
      
      // Sort by APR (highest first)
      let sortedOpportunities = [...allOpportunities].sort((a, b) => 
        b.apr.feeApr - a.apr.feeApr
      );
      
      // Apply APR filters if provided
      if (apr_gte !== undefined) {
        const minApr = apr_gte / 100;
        sortedOpportunities = sortedOpportunities.filter(opp => opp.apr.feeApr >= minApr);
      }
      
      if (apr_lte !== undefined) {
        const maxApr = apr_lte / 100;
        sortedOpportunities = sortedOpportunities.filter(opp => opp.apr.feeApr <= maxApr);
      }
      
      // Return all or limit results
      if (num_results === -1) {
        return sortedOpportunities;
      }
      
      return sortedOpportunities.slice(0, num_results);
    } catch (error) {
      console.error('Error fetching Kodiak opportunities:', error);
      return [];
    }
  }
}) 
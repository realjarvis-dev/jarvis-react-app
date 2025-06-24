import { tool } from 'ai'
import { z } from 'zod'
import { ToolContext } from '../types/context'
import { pendleOpportunitiesTool, pendleMintQuoteTool, pendleMintTool, pendleQuoteTool, pendleSwapTool } from './pendle'

function selectBestOpportunity(opportunities: any[]): any {
  if (!opportunities || opportunities.length === 0) {
    throw new Error('No opportunities available')
  }
  
  const sorted = opportunities.sort((a, b) => b.impliedApy - a.impliedApy)
  return sorted[0]
}

function calculateYTAmount(mintResult: any): string {
  if (mintResult.data?.mint_details?.output_token) {
    const outputTokens = mintResult.data.mint_details.output_token.split(',')
    if (outputTokens.length === 2) {
      return mintResult.data.mint_details.amount_in
    }
  }
  throw new Error('Unable to calculate YT amount from mint result')
}

function isProfitable(mintQuote: any): boolean {
  return mintQuote.data && !mintQuote.data.error && 
         mintQuote.data.outputAmount && parseFloat(mintQuote.data.outputAmount) > 0
}

function isYTSaleProfitable(ytQuote: any): boolean {
  return ytQuote.data && !ytQuote.data.error && 
         ytQuote.data.outputAmount && parseFloat(ytQuote.data.outputAmount) > 0
}

export const yieldOptimizationWorkflowTool = tool({
  description: 'Execute complete yield optimization workflow automatically using Pendle PT hold + YT sell strategy',
  parameters: z.object({
    amount_eth: z.string().describe('Amount of ETH to optimize in human-readable format (e.g., "1", "0.5")'),
    min_apy: z.number().optional().describe('Minimum APY threshold in percentage (e.g., 5 for 5%). Optional filter for opportunities.'),
    user_wallet_address: z.string().describe('The address of the user\'s EVM wallet')
  }),
  execute: async (params, context: ToolContext) => {
    const { amount_eth, min_apy, user_wallet_address } = params
    const results: any[] = []
    
    try {
      console.log('Step 1: Fetching Pendle opportunities...')
      const opportunities = await pendleOpportunitiesTool.execute({
        max_results: 10,
        apy_gte: min_apy
      }, context as any)
      results.push({ step: 'opportunities', data: opportunities })
      
      if (!opportunities.data || (Array.isArray(opportunities.data) && opportunities.data.length === 0)) {
        throw new Error('No suitable opportunities found')
      }
      
      console.log('Step 2: Selecting best opportunity...')
      const opportunitiesArray = Array.isArray(opportunities.data) ? opportunities.data : []
      const bestOpportunity = selectBestOpportunity(opportunitiesArray)
      results.push({ step: 'selection', data: { selected: bestOpportunity } })
      
      console.log('Step 3: Getting mint quote...')
      const mintQuote = await pendleMintQuoteTool.execute({
        pt_address: bestOpportunity.pt,
        token_input_type: 'underlying',
        token_output_type: 'py',
        amount_in_human: amount_eth,
        user_wallet_address: user_wallet_address,
        slippage: 0.005
      }, context as any)
      results.push({ step: 'mint_quote', data: mintQuote })
      
      if (isProfitable(mintQuote)) {
        console.log('Step 4: Executing mint transaction...')
        const mintResult = await pendleMintTool.execute({
          pt_address: bestOpportunity.pt,
          token_input_type: 'underlying',
          token_output_type: 'py',
          amount_in_human: amount_eth,
          user_wallet_address: user_wallet_address,
          slippage: 0.005
        }, context as any)
        results.push({ step: 'mint_execution', data: mintResult })
        
        if (mintResult.data?.success) {
          console.log('Step 5: Getting YT selling quote...')
          const ytAmount = calculateYTAmount(mintResult)
          const ytQuote = await pendleQuoteTool.execute({
            token_address: bestOpportunity.yt,
            token_type: 'yt',
            direction: 'tokenToEth',
            amount_in_human: ytAmount,
            user_wallet_address: user_wallet_address
          }, context as any)
          results.push({ step: 'yt_quote', data: ytQuote })
          
          if (isYTSaleProfitable(ytQuote)) {
            console.log('Step 6: Executing YT sale...')
            const swapResult = await pendleSwapTool.execute({
              token_address: bestOpportunity.yt,
              token_type: 'yt',
              direction: 'tokenToEth',
              amount_in_human: ytAmount,
              user_wallet_address: user_wallet_address,
              input_token_name_display: `YT ${bestOpportunity.name}`,
              output_token_name_display: 'ETH',
              slippage: 0.005
            }, context as any)
            results.push({ step: 'yt_sale', data: swapResult })
          } else {
            results.push({ step: 'yt_sale', data: { skipped: true, reason: 'YT sale not profitable' } })
          }
        } else {
          throw new Error('Minting transaction failed')
        }
      } else {
        throw new Error('Minting not profitable based on quote')
      }
      
      const strategy = 'PT hold + YT sell'
      const completedSteps = results.filter(r => r.data && !r.data.error && !r.data.skipped).length
      
      return {
        _uiDisplayTool: true,
        summary: `Yield optimization workflow completed: ${strategy} strategy executed with ${completedSteps} successful steps`,
        data: { 
          strategy,
          amount_eth,
          selected_opportunity: bestOpportunity,
          steps: results,
          completed_steps: completedSteps,
          total_steps: results.length
        }
      }
      
    } catch (error: any) {
      console.error('Workflow error:', error)
      return {
        _uiDisplayTool: true,
        summary: `Yield optimization workflow failed: ${error.message}`,
        data: {
          error: error.message,
          completed_steps: results,
          failed_at_step: results.length + 1
        }
      }
    }
  }
})

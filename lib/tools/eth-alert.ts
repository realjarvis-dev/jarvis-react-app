import { tool } from "ai"
import { z } from "zod"

export const ethAlert = tool({
    description: 'Set up a price alert for ethereum',
    parameters: z.object({
        priceThreshold: z.number().describe('The price threshold to alert at, in USD'),
        priceType: z.enum(['above', 'below']).describe('The type of price threshold to alert at, above for above the threshold, below for below the threshold'),
    })
})
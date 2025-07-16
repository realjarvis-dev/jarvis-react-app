import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'
import { DeFiLlamaPoolChartResponse } from './types'

const defiLlamaPoolAxios = axios.create()
const cachedDefiLlamaPoolAxios = setupCache(defiLlamaPoolAxios, {
    ttl: 10 * 60 * 1000, // 10 mins cache
    interpretHeader: false, // Don't use cache-control headers
    methods: ['get'] // Only cache GET requests
})

export async function lookupPoolChart(poolAddress: string) {
    const response = await cachedDefiLlamaPoolAxios.get<DeFiLlamaPoolChartResponse>(`https://yields.llama.fi/chart/${poolAddress}`)
    return response.data
}

export async function lookupPoolLatestData(poolAddress: string) {
    const poolChart = await lookupPoolChart(poolAddress)
    return poolChart.data[poolChart.data.length - 1]
}

console.log(await lookupPoolLatestData("789970a7-7ddd-4580-b86b-fe0c3844881e"))
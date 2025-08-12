// app/api/analyze/route.ts
import { getModel } from '@/lib/utils/registry'
import { generateObject, generateText } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { retrieveTool } from '../tools/retrieve'
import { createSearchTool } from '../tools/search'
const modelName = 'openai:gpt-4o'
const searchTool = createSearchTool(modelName)

export type SourceRef = {
  url: string
  title: string
  publishedAt: string
  credibility: number
}

export type Edge = {
  factor: string // e.g., "US export controls to China"
  ticker: string // "NVDA"
  channel: 1 | -1 // Anticipated sign: +1 / -1
  lagDays: number // Expected lag (trading days)
  strength: number // Prior strength (0~1)
  sources: SourceRef[] // Evidence sources
  confidence: number // Normalized confidence (0~1)
  status: 'hypothesis' | 'validated' | 'rejected'
  metrics?: Record<string, any> // { AR, CAR, p, didDelta, ... }
}

type CandidateEdge = Omit<Edge, 'status'>

// ---------- Step 0: Industry priors ----------
const PRIORS: Record<
  string,
  Record<
    string,
    { channel: 1 | -1; lagDays: [number, number]; priorWeight: number }
  >
> = {
  Semis: {
    wafer_price: { channel: -1, lagDays: [20, 60], priorWeight: 0.7 }, 
    gpu_asp: { channel: 1, lagDays: [10, 40], priorWeight: 0.6 }, 
    datacenter_capex: { channel: 1, lagDays: [10, 40], priorWeight: 0.6 },
    export_controls: { channel: -1, lagDays: [0, 20], priorWeight: 0.5 },
    tsmc_capacity: { channel: 1, lagDays: [20, 60], priorWeight: 0.5 }
  }
}

// ---------- Step 1: Use tools to collect research text ----------
async function generateResearchText(
  ticker: string,
  industry: string
): Promise<string> {
  const { text } = await generateText({
    model: getModel(modelName),
    tools: { search: searchTool, retrieve: retrieveTool },
    system: `You are an equity research assistant. Use the available tools to search and retrieve credible, recent sources relevant to the ticker and industry.
Set freshness to false when using the search tool as we focus on the news throughout the year.
Output a plain text report with TWO sections using the exact headers below:

=== RESEARCH_SOURCES ===
List 5-12 sources, one per line, using EXACTLY this pipe-delimited format:
credibility: <0-1>| date: <ISO8601>| title: <title>| url: <url>

=== CANDIDATE_FACTORS ===
Propose 3-6 candidate causal factors that may drive the stock. For each factor, write one paragraph in the format:
factor: <short factor name>; channel: <+1 or -1>; lagDays: <integer 0-120>; strength: <0-1>; sources: <comma-separated URLs used>

Constraints:
- credibility reflects source reliability; prefer primary sources and reputable outlets
- dates must be valid ISO timestamps from the article pages
- Do NOT output JSON; use only the specified plain text formats
- Keep content concise and factual`,
    prompt: `Research target: ${ticker} (${industry}). Focus on drivers and recent developments. Ensure outputs strictly follow the two sections and line formats.`,
    maxSteps: 6
  })
  return text
}

// ---------- Step 2: Extract candidate edges from research text ----------
const EdgeSchema = z.object({
  factor: z.string(),
  ticker: z.string(),
  channel: z.union([z.literal(1), z.literal(-1)]), 
  lagDays: z.number().int().min(0).max(120),
  strength: z.number().min(0).max(1),
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      publishedAt: z.string(),
      credibility: z.number()
    })
  ),
  confidence: z.number().min(0).max(1)
})
const EdgesSchema = z.object({ edges: z.array(EdgeSchema) })

async function extractCandidateEdges(
  researchText: string,
  ticker: string,
  industry: string
) {
  const priors = PRIORS[industry] ?? {}
  const res = await generateObject({
    model: getModel(modelName),
    schema: EdgesSchema,
    prompt: `You are a factor discovery agent. Read the provided research text which contains a sources section and candidate factors drafted in plain text.
Normalize into structured edges for ticker ${ticker} (${industry}).

Rules:
- Parse sources from the RESEARCH_SOURCES section; they include credibility, date, title, url
- Parse candidate factors from CANDIDATE_FACTORS; map channel to +1 or -1, clamp lagDays to [0,120], strength to [0,1]
- Attach sources to each factor by matching the URLs listed for that factor to the parsed source objects; if a URL is missing in sources, still include it with title as empty and credibility 0.5
- Apply priors when applicable: align channel to priors[key], clamp lagDays into the prior range, raise strength to at least priorWeight if the factor name includes the prior keyword
- Return JSON only per the schema

Priors:
${JSON.stringify(priors)}

Research Text:
${researchText}`
  })
  return res.object.edges
}

// ---------- Step 3: Price data (Yahoo Finance v8 chart API) ----------
function yChartUrl(
  symbol: string,
  start: number,
  end: number,
  interval: '1d' | '1h' = '1d'
) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=${interval}&events=div%2Csplit`
}
type YResp = {
  chart: {
    result?: {
      timestamp: number[]
      indicators: { quote: { close: number[] }[] }
    }[]
  }
}

async function fetchYahooCloses(
  symbol: string,
  startEpochSec: number,
  endEpochSec: number
) {
  console.log(symbol, startEpochSec, endEpochSec)
  const url = yChartUrl(symbol, startEpochSec, endEpochSec, '1d')
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const j = (await r.json()) as YResp
  const res = j.chart.result?.[0]
  if (!res) return []
  const closes = res.indicators.quote[0].close
  const ts = res.timestamp
  return ts
    .map((t, i) => ({ t: t * 1000, close: closes[i] }))
    .filter(x => Number.isFinite(x.close))
}

function dailyReturns(series: { t: number; close: number }[]) {
  const out: { t: number; r: number }[] = []
  for (let i = 1; i < series.length; i++) {
    const r = series[i].close / series[i - 1].close - 1
    out.push({ t: series[i].t, r })
  }
  return out
}

// Simple event study: window [-1,+1] excess return (relative to benchmark)
async function eventStudy(symbol: string, benchmark: string, eventISO: string) {
  console.log(symbol, benchmark, eventISO)
  const oneDay = 24 * 3600 * 1000
  const eventTs = new Date(eventISO).getTime()
  const start = Math.floor((eventTs - 5 * oneDay) / 1000)
  const end = Math.floor((eventTs + 5 * oneDay) / 1000)

  const [s, b] = await Promise.all([
    fetchYahooCloses(symbol, start, end),
    fetchYahooCloses(benchmark, start, end)
  ])
  const rs = dailyReturns(s)
  const rb = dailyReturns(b)

  // Align dates (roughly)
  const mapB = new Map(rb.map(x => [x.t, x.r]))
  const aligned = rs
    .filter(x => mapB.has(x.t))
    .map(x => ({ t: x.t, ar: x.r - (mapB.get(x.t) ?? 0) }))

  // Take one day before, same day, and one day after the event
  const window = aligned.filter(x => Math.abs(x.t - eventTs) <= 1.5 * oneDay)
  const AR = window.find(x => Math.abs(x.t - eventTs) < 0.6 * oneDay)?.ar ?? 0
  const CAR = window.reduce((acc, x) => acc + x.ar, 0)

  // Simplify: use |CAR| to transform strength, p-value using heuristic placeholder (true t-stat can be extended)
  const ARStrength = Math.min(1, Math.abs(CAR) / 0.03) // 3% cumulative as max
  const pApprox = Math.max(0.01, 1 - ARStrength) // Heuristic placeholder

  return { eventTs, AR, CAR, p: pApprox, ARStrength }
}

// ---------- Step 4: Peer DiD (optional) ----------
async function peerDiD(symbol: string, peers: string[], eventISO: string) {
  // For simplicity, use industry ETFs instead of peers: the difference with SOXX is already used as the benchmark in eventStudy
  // Real peers can be AVGO/AMD/TSM, etc., do (target - peersAvg) window difference
  return { didDelta: null, sig: null }
}

// ---------- Step 5: Scoring ----------
function scoreEdge(e: Edge) {
  const prior = Math.max(0.3, e.strength) // At least give a prior base
  const AR = e.metrics?.AR ?? 0
  const CAR = e.metrics?.CAR ?? 0
  const ARStrength = e.metrics?.ARStrength ?? 0
  const signOk = Math.sign(CAR || AR) === e.channel ? 1 : 0
  const evidenceQuality = Math.min(
    1,
    e.sources.reduce((s, d) => s + d.credibility, 0) / 2
  ) // 2.0 max credible score

  const impact =
    prior *
    (0.3 + 0.7 * signOk) *
    (0.4 + 0.6 * evidenceQuality) *
    (0.4 + 0.6 * ARStrength)

  return Math.max(0, Math.min(1, impact))
}

// ---------- Step 6: Pick event timestamp from sources ----------
function pickEventTimestampFromSources(sources: SourceRef[]) {
  // Simple pick the earliest one
  const sorted = [...sources].sort(
    (a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  )
  return sorted[0]?.publishedAt ?? new Date().toISOString()
}

// ---------- Main flow ----------
export async function main(ticker: string = 'NVDA', industry: string = 'Semis') {

  // Stage 1: Research → Candidate edges
  const researchText = await generateResearchText(ticker, industry)
  console.log(researchText)
  let candidateEdges: CandidateEdge[] = await extractCandidateEdges(
    researchText,
    ticker,
    industry
  )
  console.log(JSON.stringify(candidateEdges, null, 2))
  let edges: Edge[] = candidateEdges.map(e => ({
    ...e,
    status: 'hypothesis' as const,
    metrics: e.metrics ?? {}
  }))
  // Use priors to "clamp" LLM output (make lag/sign more stable)
  const priors = PRIORS[industry] ?? {}
  edges = edges.map(e => {
    const key = Object.keys(priors).find(k =>
      e.factor.toLowerCase().includes(k)
    )
    if (key) {
      const p = priors[key]
      e.channel = p.channel
      e.lagDays = Math.max(p.lagDays[0], Math.min(e.lagDays, p.lagDays[1]))
      e.strength = Math.max(e.strength, p.priorWeight)
    }
    return e
  })

  // Stage 2: Validate each edge (event study + optional DiD)
  for (const e of edges) {
    const eventISO = pickEventTimestampFromSources(e.sources)
    // Benchmark: SPY
    const est = await eventStudy(e.ticker, 'SPY', eventISO)
    const did = await peerDiD(e.ticker, [], eventISO)

    const signConsistent = Math.sign(est.CAR || est.AR) === e.channel
    const strongEnough = est.p <= 0.1 // simplified threshold
    e.metrics = { ...est, ...did }

    if (signConsistent && strongEnough) {
      e.status = 'validated'
    } else {
      e.status = 'rejected'
    }
    e.confidence = scoreEdge(e)
  }

  // Output: top-N + simple Markdown report
  const kept = edges
    .filter(e => e.status === 'validated')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  const report = [
    `# ${ticker} Factor Analysis (temporary DAG result)`,
    ``,
    ...kept.map((e, i) =>
      [
        `## ${i + 1}. ${e.factor}`,
        `- Anticipated sign: ${e.channel > 0 ? '+' : '-'}；Anticipated lag: ~${
          e.lagDays
        } trading days`,
        `- Event study: AR=${(e.metrics?.AR * 100).toFixed(2)}%，CAR=${(
          e.metrics?.CAR * 100
        ).toFixed(2)}%，p≈${e.metrics?.p}`,
        `- Evidence: ${e.sources
          .map(
            s => `[${s.title || s.url}](${s.url})@${s.publishedAt.slice(0, 10)}`
          )
          .join('； ')}`,
        `- Score: ${e.confidence.toFixed(1)} / 100`,
        ``
      ].join('\n')
    )
  ].join('\n')

  // (Optional) Put {edges,report} into Vercel KV/Redis, set TTL=1800s as "ephemeral DAG" for cross-request cache
  // await kv.set(`factordag:${ticker}:${Date.now()}`, { edges, report }, { ex: 1800 });

  return { edges: kept, report }
}

console.log(await main("RKLB", "space company"))
// console.log(await fetchYahooCloses('NVDA', 1718188800, 1729632000))
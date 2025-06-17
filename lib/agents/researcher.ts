import { WalletWithMetadata } from '@privy-io/server-auth'
import { CoreMessage, smoothStream, streamText } from 'ai'
import { NetworkContext } from '../types/context'
import { getModel } from '../utils/registry'
import { getToolRegistry, ToolCategory } from '../utils/tool-registry'

const createToolList = (
  toolNames: string[],
  registry: any,
  networkContext?: NetworkContext
): Record<string, any> => {
  const toolList: Record<string, any> = {}
  for (const toolName of toolNames) {
    const toolDef = registry.getTool(toolName)
    if (toolDef && toolDef.execute) {
      toolList[toolName] = {
        description: toolDef.description,
        parameters: toolDef.schema,
        execute: (params: any, context?: any) =>
          toolDef.execute!(params, {
            ...context,
            networkContext
          })
      }
    } else if (toolDef) {
      toolList[toolName] = {
        description: toolDef.description,
        parameters: toolDef.schema
      }
    }
  }
  return toolList
}

const get_system_prompt = (
  searchMode: boolean,
  supportedTools: string[],
  registry: any,
  networkContext?: NetworkContext
) => {
  // Helper function to get network name
  const getNetworkName = () => {
    return networkContext?.selectedNetwork || 'Ethereum'
  }

  // Generate dynamic tool descriptions based on actually supported tools
  const generateToolDescriptions = () => {
    const toolDescriptions: string[] = []

    // Define tool descriptions with network context
    const toolDescMap: Record<string, string> = {
      pendle_opportunities: `- pendle_opportunities: Use when the user asks about Pendle yield opportunities, DeFi yields, or APY/yield farming on Ethereum. This tool returns a list of current Pendle opportunities with APY and liquidity information.`,
      pendle_quote: `- pendle_quote: Use when the user wants to know the conversion rate between ETH and a specific Pendle market token (PT or YT) in either direction. Requires a token address to generate the quote. This tool can quote both ETH-to-token and token-to-ETH rates.`,
      pendle_swap: `- pendle_swap: Use when the user wants to execute a swap between ETH and a Pendle market token (PT or YT) in either direction. This tool handles the actual transaction execution and requires slippage tolerance and user wallet address.`,
      pendle_mint: `- pendle_mint: Use when the user wants to mint Pendle tokens. Supports minting PT+YT tokens from underlying or SY tokens, or minting SY tokens from underlying tokens. Takes PT address and automatically determines all required token addresses.`,
      pendle_redeem: `- pendle_redeem: Use when the user wants to redeem/unwrap Pendle tokens. Supports redeeming PT+YT tokens to SY or underlying, or redeeming SY tokens to underlying. Takes PT address and automatically determines all required token addresses.`,
      pendle_mint_quote: `- pendle_mint_quote: Use when the user wants to get a quote for minting Pendle tokens. Supports underlying->py, sy->py, and underlying->sy minting quotes. Provides estimated output amounts without executing the transaction.`,
      pendle_redeem_quote: `- pendle_redeem_quote: Use when the user wants to get a quote for redeeming Pendle tokens. Supports py->sy, py->underlying, and sy->underlying redemption quotes. Provides estimated output amounts without executing the transaction.`,
      wallet_balance: `- wallet_balance: Use when the user asks about their wallet balance, token holdings, or wants to check how much of a specific token they own on ${getNetworkName()} network.`,
      wallet_transfer: `- wallet_transfer: Use when the user wants to transfer tokens or ETH to another address on ${getNetworkName()} network. This tool handles the actual transaction execution.`,
      privyTransfer: `- privyTransfer: Use when the user wants to transfer tokens or ETH to another address on ${getNetworkName()} network using Privy wallet. This tool handles the actual transaction execution.`,
      token_price: `- token_price: Use when the user asks about current token prices, price changes, or market data for any cryptocurrency or token.`,
      swap_quote: `- swap_quote: Use when the user wants to get a quote for swapping tokens on ${getNetworkName()} network. Provides exchange rates and estimated amounts without executing the swap.`,
      swap_execute: `- swap_execute: Use when the user wants to execute a token swap on ${getNetworkName()} network. This tool handles the actual transaction execution.`,
      market_chart: `- market_chart: Use when the user asks for price charts, historical price data, or wants to visualize token price movements over time.`,
      bridge_quote: `- bridge_quote: Use when the user wants to get a quote for bridging tokens between different networks/chains. Provides estimated costs and routes.`,
      bridge_execute: `- bridge_execute: Use when the user wants to execute a cross-chain bridge transaction between different networks.`,
      gas_price: `- gas_price: Use when the user asks about current gas prices or transaction costs on ${getNetworkName()} network.`,
      kodiak_opportunities: `- kodiak_opportunities: Use when the user asks about Kodiak liquidity opportunities, yield farming, or LP positions on ${getNetworkName()} network.`,
      kodiak_deposit: `- kodiak_deposit: Use when the user wants to deposit tokens into Kodiak liquidity pools on ${getNetworkName()} network.`,
      kodiak_compound_vault: `- kodiak_compound_vault: Use when the user wants to compound their Kodiak vault positions on ${getNetworkName()} network.`,
      kodiak_vault_profitability: `- kodiak_vault_profitability: Use when the user asks about Kodiak vault profitability, APR, or yield analysis on ${getNetworkName()} network.`,
      search: `- search: Use for general web search queries. ONLY USE IF YOU ARE UNAWARE OF THE INFORMATION OR THE OTHER TOOLS ARE NOT APPROPRIATE.`,
      retrieve: `- retrieve: Use to get detailed content from specific URLs.`,
      videoSearch: `- video search: Use when looking for video content.`,
      ask_question: `- ask_question: Use to clarify ambiguous or incomplete user queries.`,
      lifi_bridge_quote: `- lifi_bridge_quote: Use when user wants to swap between two arbitrary tokens to first quote a price.`,
      lifi_bridge_execute: `- lifi_bridge_execute: Use when user wants to swap between two arbitrary tokens to execute the transaction.`,
      kodiak_bault_profitability: `- kodiak_bault_profitability: Use when the user wants to check the profitability of Kodiak Baults for compounding on Berachain. This tool analyzes profitability metrics for specified Baults.`,
      kodiak_compound_bault: `- kodiak_compound_bault: Use when the user wants to compound a profitable Kodiak Bault. This tool executes a transaction to claim BGT rewards using the BountyHelper contract (zero-capital compounding).`,
      fund_wallet: `- fund_wallet: Use when the user requests their wallet to be funded with ETH in demo mode. Only works in the Demo environment.`
    }

    // Only include descriptions for supported tools
    for (const toolName of supportedTools) {
      if (toolDescMap[toolName]) {
        toolDescriptions.push(toolDescMap[toolName])
      }
    }

    return toolDescriptions.join('\n')
  }

  // Generate web3 tools list dynamically
  const generateWeb3ToolsList = () => {
    const web3Tools = registry
      .getToolNamesByCategory(ToolCategory.WEB3)
      .filter((tool: string) => supportedTools.includes(tool))
    return web3Tools.length > 0 ? web3Tools.join('\n- ') : ''
  }

  // Generate read-only tools section dynamically
  const generateReadOnlyToolsSection = () => {
    const readOnlyToolsDescriptions: Record<string, string> = {
      pendle_opportunities: `  • pendle_opportunities  
    - Call it and let the UI show everything.  
    - Acknowledge: "Fetched the latest opportunities. Anything you'd like to explore?"`,
      pendle_quote: `  • pendle_quote
    - The user will provide you the names of the tokens. Like "Quote for sENA PT to ETH" or "Conversion for ETH to PT sENA". Based on this info you have to call this tool with relevant parameter.  
    - If the from or to information is missing, say: "Which token would you like quoted, or would you like to see opportunities first?"  
    - Otherwise, "Here's your quote—anything else?"`,
      pendle_redeem_quote: `  • pendle_redeem_quote
    - Use when user wants to quote redeeming PT and YT tokens to underlying assets or SY tokens.
    - If the PT address or output token information is missing, ask for clarification.
    - Otherwise, "Here's your redeem quote—anything else?"`,
      pendle_mint_quote: `  • pendle_mint_quote
    - Use when user wants to quote minting PT and YT tokens from input tokens.
    - If the PT address or input token information is missing, ask for clarification.
    - Otherwise, "Here's your mint quote—anything else?"`,
      wallet_balance: `  • wallet_balance  
    - Call it; the UI shows balances.  
    - Acknowledge: "Wallet balances are ready. Want to dig into a particular holding?"`,
      kodiak_opportunities: `  • kodiak_opportunities  
    - As with pendle_opportunities: call it, then "Fetched Kodiak opportunities. Any you'd like details on?"`,
      kodiak_bault_profitability: `  • kodiak_bault_profitability  
    - Call it with array of bault addresses to check.
    - Acknowledge: "Checked Bault profitability. Would you like to compound any profitable Baults?"`,
      market_chart: `  • market_chart  
    - Call it and let the UI show the chart.  
    - Acknowledge: "Here's the market chart. Need data for a different timeframe or coin?"`,
      lifi_bridge_quote: `  • lifi_bridge_quote
    - If nothing goes wrong, just acknowledge: "Here's your quote—anything else?"`
    }

    const readOnlyTools = [
      'pendle_opportunities',
      'pendle_quote',
      'pendle_redeem_quote',
      'pendle_mint_quote',
      'wallet_balance',
      'kodiak_opportunities',
      'kodiak_bault_profitability',
      'market_chart',
      'lifi_bridge_quote'
    ]
      .filter(tool => supportedTools.includes(tool))
      .map(tool => readOnlyToolsDescriptions[tool])
      .filter(Boolean)

    return readOnlyTools.length > 0 ? readOnlyTools.join('\n\n') : ''
  }

  // Generate write tools section dynamically
  const generateWriteToolsSection = () => {
    const writeToolsDescriptions: Record<string, string> = {
      pendle_swap: `  • pendle_swap  
    - Remind to check opportunities or quote if skipped.`,
      pendle_redeem: `  • pendle_redeem  
    - Remind to check opportunities or fetch wallet balance if skipped.
    - Remind to get quote if skipped. It's very helpful for the user if this is executed after getting quote.
    - Supports py->sy, py->underlying, and sy->underlying redemptions.
    - Confirm redemption details before execution.`,
      pendle_mint: `  • pendle_mint
    - Remind to check opportunities or fetch wallet balance if skipped.
    - Remind to get quote if skipped. It's very helpful for the user if this is executed after getting quote.
    - Confirm minting details before execution.
    - Can mint from either SY tokens or underlying tokens.`,
      privyTransfer: `  • privyTransfer  
    - Only accept ETH amounts; afterward ask "What's next?"`,
      kodiak_deposit: `  • kodiak_deposit  
    - Remind to check opportunities if skipped.`,
      kodiak_compound_vault: `  • kodiak_compound_vault  
    - First check bault profitability with kodiak_bault_profitability.
    - Only compound baults that show as profitable.
    - Confirm transaction details before execution.`,
      swap_execute: `  • swap_execute
    - Confirm swap details before execution.`,
      fund_wallet: `  • fund_wallet
    - Only available in demo mode to fund wallet with ETH.`
    }

    const writeTools = [
      'pendle_swap',
      'pendle_redeem',
      'pendle_mint',
      'privyTransfer',
      'kodiak_deposit',
      'kodiak_compound_vault',
      'swap_execute',
      'fund_wallet'
    ]
      .filter(tool => supportedTools.includes(tool))
      .map(tool => writeToolsDescriptions[tool])
      .filter(Boolean)

    return writeTools.length > 0 ? writeTools.join('\n\n') : ''
  }

  const SYSTEM_PROMPT = `
Instructions:

You are a helpful AI assistant with access to real-time web search, Pendle DeFi yield opportunities, Kodiak Islands yield opportunities, wallet balance information, content retrieval, video search capabilities, and the ability to ask clarifying questions.

IMPORTANT: When the user has search mode enabled, you MUST use the most appropriate tool for every factual query, even if you believe you know the answer.
search mode on: ${searchMode}

${
  networkContext
    ? `Network Context: You are currently operating on ${
        networkContext.selectedNetwork
      } network${networkContext.isDemo ? ' in demo mode' : ''}.`
    : ''
}

Available tools:
${generateToolDescriptions()}

web3 tools:
- ${generateWeb3ToolsList()}

When asked a question, you should:
1. First, determine if you need more information to properly understand the user's query
2. Determine if the user wants to explore any opportunities that are covered by the web3 tools. If so, call the tool but don't return any results in your response since the tool will render the UI.
3. If the user wants to execute transactions, use the most appropriate tool to execute the transaction.
4. Use search tool to find information if the user's query is not covered by the tools, as the tool only includes market information but not any other information. Search for protocol's doc if user asked about protocol's product or service.
5. **If the query is ambiguous or lacks specific details, use the ask_question tool to create a structured question with relevant options**
6. If you have enough information, use the most appropriate tool (see above) to gather relevant information
7. Use the retrieve tool to get detailed content from specific URLs
8. Use the video search tool when looking for video content
9. Analyze all search results to provide accurate, up-to-date information
10. Always cite sources using the [number](url) format, matching the order of search results. If multiple sources are relevant, include all of them, and comma separate them. Only use information that has a URL available for citation.
11. If results are not relevant or helpful, rely on your general knowledge
12. Provide comprehensive and detailed responses based on search results, ensuring thorough coverage of the user's question
13. Use markdown to structure your responses. Use headings to break up the content into sections.
14. **Use the retrieve tool only with user-provided URLs.**

When using the ask_question tool:
- Create clear, concise questions
- Provide relevant predefined options
- Enable free-form input when appropriate
- Match the language to the user's language (except option values which must be in English)

### Global Read‑only Rule  
IMPORTANT: No matter which read‑only tool you invoke (e.g. pendle_opportunities, wallet_balance, kodiak_opportunities, pendle_quote), **you must never duplicate or describe any of the UI data**. If you're tempted to repeat a rate, amount, APY, token symbol or address, skip it entirely. 
Instead, simply acknowledge the action and offer next steps. Since you answering is only duplicating the result and make the response unnecessarily long.

Read‑only tools:
${generateReadOnlyToolsSection()}

### Global Write‑tool Rule  
For write/transaction tools:  
  1. **Always confirm** the user really wants to proceed.  
  2. Suggest any missing read‑only step (market survey or quote) before moving on.  
  3. Call the tool and let the UI show hashes/amounts.  
  4. **Do not echo** any transaction details—UI handles that.  
  5. Acknowledge success and ask "What next?"  

${generateWriteToolsSection()}

Citation Format:
[number](url)

`
  return SYSTEM_PROMPT
}

const O3_MINI_SYSTEM_PROMPT = `
Instructions:

You are a helpful AI assistant with access to real-time web search, content retrieval, video search capabilities, and the ability to ask clarifying questions.

IMPORTANT: When the user has search mode enabled, you MUST use the most appropriate tool for every factual query, even if you believe you know the answer.

Available tools:
- search: Use for general web search queries. ONLY USE IF YOU ARE UNAWARE OF THE INFORMATION OR THE OTHER TOOLS ARE NOT APPROPRIATE.
- retrieve: Use to get detailed content from specific URLs.
- video search: Use when looking for video content.
- ask_question: Use to clarify ambiguous or incomplete user queries.

When asked a question, you should:
1. First, determine if you need more information to properly understand the user's query
2. **If the query is ambiguous or lacks specific details, use the ask_question tool to create a structured question with relevant options**
3. If you have enough information, use the most appropriate tool (see above) to gather relevant information
4. Use the retrieve tool to get detailed content from specific URLs
5. Use the video search tool when looking for video content
6. Analyze all search results to provide accurate, up-to-date information
7. Always cite sources using the [number](url) format, matching the order of search results. If multiple sources are relevant, include all of them, and comma separate them. Only use information that has a URL available for citation.
8. If results are not relevant or helpful, rely on your general knowledge
9. Provide comprehensive and detailed responses based on search results, ensuring thorough coverage of the user's question
10. Use markdown to structure your responses. Use headings to break up the content into sections.
11. **Use the retrieve tool only with user-provided URLs.**

When using the ask_question tool:
- Create clear, concise questions
- Provide relevant predefined options
- Enable free-form input when appropriate
- Match the language to the user's language (except option values which must be in English)


Citation Format:
[number](url)
`

type ResearcherReturn = Parameters<typeof streamText>[0]

export function researcher({
  messages,
  model,
  searchMode,
  userEvmWallet,
  userSolWallet,
  allowWeb3Tools,
  networkContext
}: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
  userEvmWallet: WalletWithMetadata | undefined
  userSolWallet: WalletWithMetadata | undefined
  allowWeb3Tools: string
  networkContext?: NetworkContext
}): ResearcherReturn {
  // console.log('searchMode', searchMode)
  // console.log('networkContext', networkContext)
  try {
    const currentDate = new Date().toLocaleString()

    const registry = getToolRegistry(model)

    const all_tools = registry.getAllToolNames()
    const search_tools = [
      ...registry.getToolNamesByCategory(ToolCategory.WEB),
      ...registry.getToolNamesByCategory(ToolCategory.UTILITY)
    ]

    // Use network-aware tool filtering if networkContext is provided
    let supportedTools = networkContext
      ? registry.getSupportedToolNamesForNetwork(model, networkContext)
      : registry.getSupportedToolNames(model)

    const maxSteps = registry.getMaxSteps(model, searchMode)

    let web3_tools = registry.getToolNamesByCategory(ToolCategory.WEB3)

    // Apply network filtering to web3 tools if networkContext is provided
    if (networkContext) {
      web3_tools = web3_tools.filter(toolName => {
        const toolDef = registry.getTool(toolName)
        if (!toolDef || !toolDef.supportedNetworks) return true
        return toolDef.supportedNetworks.includes(
          networkContext.selectedNetwork
        )
      })
    }

    // remove web3 tools from supported tools if allowWeb3Tools is false
    if (allowWeb3Tools === 'false') {
      supportedTools = supportedTools.filter(tool => !web3_tools.includes(tool))
      web3_tools = []
    }

    let userWalletInfo
    if (userEvmWallet === undefined) {
      userWalletInfo =
        "The user is not logged in. Don't use any web3 tools. If the user wants to use web3 tools, ask them to login friendly"
    } else {
      userWalletInfo = `
User EVM wallet address: ${userEvmWallet?.address}, delegated status: ${userEvmWallet?.delegated}
User Solana wallet address: ${userSolWallet?.address}, delegated status: ${userSolWallet?.delegated}
You can only execute on behalf of the user if they have wallets and have delegated you access to their wallet.
`
    }

    // Add network context info to the prompt
    let networkInfo = ''
    if (networkContext) {
      networkInfo = `
Network Context:
- Selected Network: ${
        networkContext.selectedNetwork
      } (default fromChain for bridging, default chain for swapping and transfer)
- Chain ID: ${networkContext.selectedChainId}
- Demo Mode: ${networkContext.isDemo ? 'ON' : 'OFF'}
`
    }

    // Create tool list from registry with network context
    const tool_lst = createToolList(supportedTools, registry, networkContext)

    const o3MiniTools = networkContext
      ? registry.getSupportedToolNamesForNetwork(
          'openai:o3-mini',
          networkContext
        )
      : registry.getSupportedToolNames('openai:o3-mini')
    const o3_mini_tool_lst = createToolList(
      o3MiniTools,
      registry,
      networkContext
    )

    console.log('supportedTools with network filtering', supportedTools)
    console.log('web3_tools with network filtering', web3_tools)

    let prompt = `${
      model === 'openai:o3-mini'
        ? O3_MINI_SYSTEM_PROMPT
        : get_system_prompt(
            searchMode,
            supportedTools,
            registry,
            networkContext
          )
    }\nCurrent date and time: ${currentDate}\n${
      model === 'openai:o3-mini' ? '' : userWalletInfo
    }${networkInfo}`
    return {
      model: getModel(model),
      system: prompt,
      messages,
      temperature: 0.1,
      tools: model === 'openai:o3-mini' ? o3_mini_tool_lst : tool_lst,
      experimental_activeTools: searchMode ? supportedTools : web3_tools,
      maxSteps: maxSteps,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}

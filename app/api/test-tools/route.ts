import { berachainConfig, TENDERLY_DEMO_CONFIG } from '@/lib/network/config';
import { NetworkContext } from '@/lib/types/context';
import { createToolRegistry } from '@/lib/utils/tool-registry';
import { NextRequest, NextResponse } from 'next/server';

// Static sample wallet address for testing framework
const STATIC_SAMPLE_ADDRESS = '0x742d35Cc6634C0532925a3b8D0e5e1eD86a16FEe';

// Function to get test configurations with static user address
function getTestConfigs() {
  return {
    // Ethereum-based tools (using demo net)
    ethereum: {
      pendle_opportunities: {
        max_results: 7,
        apy_gte: 1,
        apy_lte: 15
      },
      pendle_quote: {
        token_address: 'PT-sENA-25SEP2025',
        user_wallet_address: STATIC_SAMPLE_ADDRESS, // Use static address
        amount_in_human: '1',
        token_type: 'pt',
        direction: 'ethToToken'
      },
      // Add more ethereum-based tools here as needed
    },
    
    // Berachain-based tools (using mainnet)
    berachain: {
      kodiak_opportunities: {
        // apr_gte: undefined (not passed)
        // apr_lte: undefined (not passed)  
        // bault_apr_gte: undefined (not passed)
        // bault_apr_lte: undefined (not passed)
        // bault_tvl_gte: undefined (not passed)
        // bault_tvl_lte: undefined (not passed)
        sort_by: 'apr',
        max_results: 15,
        bault_filter: 'only'
      },
      kodiak_bault_profitability: {
        bault_addresses: [
            '0x05bfda2b7c528cd946356c263ee9c7d847ee05ea',
            '0xd0d4e446e033040a8394c6f2005e67feddd76bc1',
            '0xd3fa0b46977a0e512c970a3451080fcd846b5e12'
          ],
        slippage_bps: 100,
        min_profit_percentage: 5
      },
      // Add more berachain-based tools here as needed
    }
  } as const
}

// Tool to network mapping
const TOOL_NETWORK_MAPPING = {
  // Ethereum tools (using registry names with underscores)
  pendle_opportunities: 'ethereum',
  pendle_quote: 'ethereum',
  pendle_swap: 'ethereum',
  pendle_mint: 'ethereum',
  pendle_mint_quote: 'ethereum',
  pendle_redeem: 'ethereum',
  pendle_redeem_quote: 'ethereum',
  pendle_zap_in_quote: 'ethereum',
  pendle_zap_in_execute: 'ethereum',
  pendle_zap_out_quote: 'ethereum',
  pendle_zap_out_execute: 'ethereum',
  
  // Berachain tools
  kodiak_opportunities: 'berachain',
  kodiak_deposit: 'berachain',
  kodiak_bault_profitability: 'berachain',
  kodiak_compound_bault: 'berachain',
  
  // Multi-network tools (default to ethereum for testing)
  wallet_balance: 'ethereum',
  get_gas_price: 'ethereum',
  bridge_quote: 'ethereum',
  bridge_execute: 'ethereum',
  privy_transfer: 'ethereum',
} as const

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const toolName = searchParams.get('tool')
  const networkType = searchParams.get('network') // 'demo' or 'mainnet'
  
  try {
    if (!toolName) {
      // Return list of available tools for testing
      const availableTests = {
        ethereum_demo: Object.keys(getTestConfigs().ethereum),
        berachain_mainnet: Object.keys(getTestConfigs().berachain)
      }
      
      return NextResponse.json({
        message: 'Available tool tests',
        availableTests,
        toolNetworkMapping: TOOL_NETWORK_MAPPING
      })
    }
    
    // Determine which network config to use for this tool
    const toolNetworkType = TOOL_NETWORK_MAPPING[toolName as keyof typeof TOOL_NETWORK_MAPPING]
    if (!toolNetworkType) {
      return NextResponse.json({
        error: `Tool '${toolName}' not found in tool network mapping`
      }, { status: 404 })
    }
    
    // Set up network context based on tool type
    let networkContext: NetworkContext
    let testConfig: any
    
    if (toolNetworkType === 'ethereum') {
      // Use demo net for ethereum tools
      networkContext = {
        selectedNetwork: 'ethereum',
        selectedChainId: TENDERLY_DEMO_CONFIG.chainId,
        isDemo: true,
        rpcUrl: TENDERLY_DEMO_CONFIG.rpcUrl,
        config: TENDERLY_DEMO_CONFIG
      }
      testConfig = getTestConfigs().ethereum[toolName as keyof ReturnType<typeof getTestConfigs>['ethereum']]
    } else if (toolNetworkType === 'berachain') {
      // Use berachain mainnet for berachain tools  
      networkContext = {
        selectedNetwork: 'berachain',
        selectedChainId: berachainConfig.chainId,
        isDemo: false,
        rpcUrl: berachainConfig.rpcUrl,
        config: berachainConfig
      }
      testConfig = getTestConfigs().berachain[toolName as keyof ReturnType<typeof getTestConfigs>['berachain']]
    } else {
      return NextResponse.json({
        error: `Unsupported network type: ${toolNetworkType}`
      }, { status: 400 })
    }
    
    if (!testConfig) {
      return NextResponse.json({
        error: `No test configuration found for tool '${toolName}' on network '${toolNetworkType}'`
      }, { status: 404 })
    }
    
    // Create tool registry and get the tool
    const registry = createToolRegistry('claude-3-5-sonnet-20241022') // Default model
    const tool = registry.getTool(toolName)
    
    if (!tool) {
      return NextResponse.json({
        error: `Tool '${toolName}' not found in registry`
      }, { status: 404 })
    }
    
    // Execute the tool with test configuration
    console.log(`Executing tool '${toolName}' with config:`, testConfig)
    console.log(`Network context:`, networkContext)
    
    const startTime = Date.now()
    const result = await tool.execute!(testConfig, {
      toolCallId: `test-${toolName}-${Date.now()}`,
      messages: [],
      networkContext
    })
    const endTime = Date.now()
    
    return NextResponse.json({
      toolName,
      networkType: toolNetworkType,
      networkContext: {
        network: networkContext.selectedNetwork,
        chainId: networkContext.selectedChainId,
        isDemo: networkContext.isDemo
      },
      testConfig,
      result,
      executionTime: endTime - startTime,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Error executing tool test:', error)
    return NextResponse.json({
      error: error.message || 'Failed to execute tool test',
      toolName,
      networkType: networkType || 'unknown'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolName, customConfig, networkType } = body
    
    if (!toolName) {
      return NextResponse.json({
        error: 'Tool name is required'
      }, { status: 400 })
    }
    
    // Similar logic to GET but with custom config
    const toolNetworkType = networkType || TOOL_NETWORK_MAPPING[toolName as keyof typeof TOOL_NETWORK_MAPPING]
    if (!toolNetworkType) {
      return NextResponse.json({
        error: `Tool '${toolName}' not found in tool network mapping`
      }, { status: 404 })
    }
    
    // Set up network context
    let networkContext: NetworkContext
    
    if (toolNetworkType === 'ethereum') {
      networkContext = {
        selectedNetwork: 'ethereum',
        selectedChainId: TENDERLY_DEMO_CONFIG.chainId,
        isDemo: true,
        rpcUrl: TENDERLY_DEMO_CONFIG.rpcUrl,
        config: TENDERLY_DEMO_CONFIG
      }
    } else if (toolNetworkType === 'berachain') {
      networkContext = {
        selectedNetwork: 'berachain',
        selectedChainId: berachainConfig.chainId,
        isDemo: false,
        rpcUrl: berachainConfig.rpcUrl,
        config: berachainConfig
      }
    } else {
      return NextResponse.json({
        error: `Unsupported network type: ${toolNetworkType}`
      }, { status: 400 })
    }
    
    // Create tool registry and get the tool
    const registry = createToolRegistry('claude-3-5-sonnet-20241022')
    const tool = registry.getTool(toolName)
    
    if (!tool) {
      return NextResponse.json({
        error: `Tool '${toolName}' not found in registry`
      }, { status: 404 })
    }
    
    // Use custom config or fall back to default test config
    const testConfig = customConfig || 
      (toolNetworkType === 'ethereum' ? 
        getTestConfigs().ethereum[toolName as keyof ReturnType<typeof getTestConfigs>['ethereum']] :
        getTestConfigs().berachain[toolName as keyof ReturnType<typeof getTestConfigs>['berachain']])
    
    if (!testConfig) {
      return NextResponse.json({
        error: `No test configuration provided for tool '${toolName}'`
      }, { status: 400 })
    }
    
    // Execute the tool
    console.log(`Executing tool '${toolName}' with custom config:`, testConfig)
    
    const startTime = Date.now()
    const result = await tool.execute!(testConfig, {
      toolCallId: `test-custom-${toolName}-${Date.now()}`,
      messages: [],
      networkContext
    })
    const endTime = Date.now()
    
    return NextResponse.json({
      toolName,
      networkType: toolNetworkType,
      networkContext: {
        network: networkContext.selectedNetwork,
        chainId: networkContext.selectedChainId,
        isDemo: networkContext.isDemo
      },
      testConfig,
      result,
      executionTime: endTime - startTime,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Error executing custom tool test:', error)
    return NextResponse.json({
      error: error.message || 'Failed to execute custom tool test'
    }, { status: 500 })
  }
}
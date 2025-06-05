import { NetworkConfig } from "../config/network-selection"

/**
 * Network context passed to tools
 */
export interface NetworkContext {
    selectedNetwork: 'ethereum' | 'berachain' | 'demo'
    selectedChainId: number
    isDemo: boolean
    rpcUrl: string
    config: NetworkConfig
  }
  
  /**
   * Tool context interface that matches what tools expect
   */
  export interface ToolContext {
    toolCallId?: string
    messages?: any[]
    networkContext?: NetworkContext
  }
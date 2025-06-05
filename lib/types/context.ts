import { ChainType, NetworkConfig } from "@/lib/network/types"


/**
 * Network context passed to tools
 */
export interface NetworkContext {
    selectedNetwork: ChainType
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
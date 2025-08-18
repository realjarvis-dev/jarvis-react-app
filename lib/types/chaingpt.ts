// ChainGPT Web3 Agent Types and Schemas

export interface ChainGPTWeb3Response {
  response: string
  timestamp: string
  source: 'ChainGPT Web3 AI' | 'ChainGPT Web3 AI (Streaming)'
  context?: string
  error?: string
  question: string
  response_type?: 'comprehensive' | 'concise' | 'technical' | 'beginner_friendly'
  domain_focus?: 'defi' | 'nft' | 'trading' | 'development' | 'security' | 'general_web3'
  user_level?: 'beginner' | 'intermediate' | 'advanced'
  session_id?: string
  metadata?: {
    tone: 'professional' | 'friendly' | 'technical' | 'educational'
    include_examples: boolean
    save_history: boolean
    enhanced_prompt: string
  }
}

export interface ChainGPTStreamResponse {
  stream_initiated: boolean
  question: string
  domain_focus?: 'defi' | 'nft' | 'trading' | 'development' | 'security' | 'general_web3'
  user_level?: 'beginner' | 'intermediate' | 'advanced'
  tone: 'professional' | 'friendly' | 'technical' | 'educational'
  timestamp: string
  source: 'ChainGPT Web3 AI (Streaming)'
  enhanced_prompt?: string
  error?: string
}

export interface ChainGPTChatHistory {
  history: ChainGPTHistoryItem[]
  total: number
  session_id: string
  error?: string
}

export interface ChainGPTHistoryItem {
  id: string
  question: string
  response: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface ChainGPTContextInjection {
  companyName?: string
  companyDescription?: string
  companyWebsiteUrl?: string
  whitePaperUrl?: string
  purpose?: string
  cryptoToken?: boolean
  tokenInformation?: {
    tokenName?: string
    tokenSymbol?: string
    tokenAddress?: string
    tokenSourceCode?: string
    tokenAuditUrl?: string
    exploreUrl?: string
    cmcUrl?: string
    coingeckoUrl?: string
    blockchain?: string[]
  }
  socialMediaUrls?: Array<{ name: string; url: string }>
  limitation?: boolean
  aiTone?: 'DEFAULT_TONE' | 'CUSTOM_TONE' | 'PRE_SET_TONE'
  selectedTone?: 'PROFESSIONAL' | 'FRIENDLY' | 'INFORMATIVE' | 'FORMAL' | 'CONVERSATIONAL' | 'AUTHORITATIVE' | 'PLAYFUL' | 'INSPIRATIONAL' | 'CONCISE' | 'EMPATHETIC' | 'ACADEMIC' | 'NEUTRAL' | 'SARCASTIC_MEME_STYLE'
  customTone?: string
}

// Domain-specific response types
export interface DeFiAnalysis {
  protocols: string[]
  risks: string[]
  opportunities: string[]
  recommendations: string[]
}

export interface NFTInsight {
  collections: string[]
  market_trends: string[]
  trading_strategies: string[]
  valuation_factors: string[]
}

export interface TradingAnalysis {
  market_conditions: string[]
  technical_indicators: string[]
  risk_management: string[]
  entry_exit_strategies: string[]
}

export interface SecurityAssessment {
  vulnerabilities: string[]
  best_practices: string[]
  audit_recommendations: string[]
  risk_mitigation: string[]
}

export interface DevelopmentGuidance {
  technologies: string[]
  frameworks: string[]
  code_examples: string[]
  deployment_steps: string[]
}

// Utility types for UI components
export interface ChainGPTUIProps {
  response: ChainGPTWeb3Response
  isLoading?: boolean
  onRetry?: () => void
  onSaveHistory?: (sessionId: string) => void
}

export interface ChainGPTStreamUIProps {
  streamResponse: ChainGPTStreamResponse
  isStreaming?: boolean
  onStreamComplete?: (response: string) => void
}

// Configuration types
export interface ChainGPTConfig {
  apiKey: string
  defaultTone: 'professional' | 'friendly' | 'technical' | 'educational'
  defaultUserLevel: 'beginner' | 'intermediate' | 'advanced'
  enableHistory: boolean
  maxHistoryItems: number
}

// Error types
export interface ChainGPTError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
}

// Analytics types for tracking usage
export interface ChainGPTAnalytics {
  question_type: string
  domain_focus?: string
  user_level: string
  response_time: number
  success: boolean
  error_type?: string
}

/**
 * Utility for wrapping tool execution with timeout handling to prevent UI freezing
 */

export interface TimeoutConfig {
  timeout?: number // Timeout in milliseconds, default 25000 (25 seconds)
  toolName?: string // Tool name for better error messages
}

/**
 * Wraps a tool execution function with timeout handling
 * Returns a proper _uiDisplayTool response format on timeout to prevent UI freezing
 */
export function withTimeout<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: TimeoutConfig = {}
): T {
  const { timeout = 25000, toolName = 'Tool' } = config
  
  return (async (...args: Parameters<T>) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${toolName} execution timed out after ${timeout}ms`))
      }, timeout)
    })

    try {
      const result = await Promise.race([
        fn(...args),
        timeoutPromise
      ])
      return result
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes('timed out')
      
      return {
        _uiDisplayTool: true,
        summary: isTimeout 
          ? `${toolName} timed out`
          : `${toolName} failed`,
        data: {
          error: isTimeout 
            ? `${toolName} execution timed out after ${timeout / 1000} seconds. This may be due to network issues or heavy blockchain load. Please try again.`
            : error instanceof Error ? error.message : String(error),
          timeout: isTimeout,
          toolName
        }
      }
    }
  }) as T
}

/**
 * Creates a timeout-wrapped version of a tool execution function
 * Specifically designed for blockchain transaction tools
 */
export function withTransactionTimeout<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  toolName: string
): T {
  return withTimeout(fn, {
    timeout: 30000, // 30 seconds for transaction tools
    toolName
  })
}

/**
 * Creates a timeout-wrapped version of a tool execution function
 * Designed for API/data fetching tools
 */
export function withApiTimeout<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  toolName: string
): T {
  return withTimeout(fn, {
    timeout: 15000, // 15 seconds for API tools
    toolName
  })
}
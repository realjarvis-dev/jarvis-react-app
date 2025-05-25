import { z } from 'zod'

/**
 * Error types for better error classification and handling
 */
export enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  UNKNOWN = 'unknown'
}

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  success: false
  error: {
    type: ErrorType
    message: string
    details?: any
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error?.type === ErrorType.NETWORK) return true
  
  if (error?.type === ErrorType.TIMEOUT) return true
  
  if (error?.type === ErrorType.UNKNOWN) {
    const message = error?.message?.toLowerCase() || ''
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    )
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset')
    )
  }
  
  return false
}

/**
 * Create a standard error response
 */
export function createErrorResponse(
  type: ErrorType,
  message: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error: {
      type,
      message,
      details
    }
  }
}

/**
 * Create a validation error response from Zod error
 */
export function createValidationErrorResponse(
  error: z.ZodError
): ErrorResponse {
  return createErrorResponse(
    ErrorType.VALIDATION,
    'Invalid parameters provided',
    error.format()
  )
}

/**
 * Execute a function with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
    retryableCheck?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffFactor = 2,
    retryableCheck = isRetryableError
  } = options
  
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (!retryableCheck(error)) {
        break
      }
      
      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt) * (0.5 + Math.random()),
        maxDelay
      )
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * Wrap a tool execution function with retry and error handling
 */
export function withErrorHandling<T, R>(
  fn: (params: T, context?: any) => Promise<R>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
    retryableCheck?: (error: any) => boolean
    defaultErrorMessage?: string
  } = {}
): (params: T, context?: any) => Promise<R | ErrorResponse> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffFactor = 2,
    retryableCheck = isRetryableError,
    defaultErrorMessage = 'An error occurred during tool execution'
  } = options
  
  return async (params: T, context?: any): Promise<R | ErrorResponse> => {
    try {
      return await executeWithRetry(
        () => fn(params, context),
        {
          maxRetries,
          initialDelay,
          maxDelay,
          backoffFactor,
          retryableCheck
        }
      )
    } catch (error) {
      console.error('Error in tool execution:', error)
      
      let errorType = ErrorType.UNKNOWN
      let errorMessage = defaultErrorMessage
      
      if (error instanceof z.ZodError) {
        errorType = ErrorType.VALIDATION
        errorMessage = 'Invalid parameters provided'
      } else if (error instanceof Error) {
        errorMessage = error.message
        
        const message = error.message.toLowerCase()
        if (message.includes('network') || message.includes('connection')) {
          errorType = ErrorType.NETWORK
        } else if (message.includes('timeout')) {
          errorType = ErrorType.TIMEOUT
        } else if (message.includes('permission') || message.includes('unauthorized')) {
          errorType = ErrorType.PERMISSION
        } else if (message.includes('not found') || message.includes('404')) {
          errorType = ErrorType.NOT_FOUND
        }
      }
      
      return createErrorResponse(errorType, errorMessage, error)
    }
  }
}

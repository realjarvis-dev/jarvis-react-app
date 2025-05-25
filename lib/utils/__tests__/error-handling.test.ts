import { z } from 'zod'
import {
  ErrorType,
  isRetryableError,
  createErrorResponse,
  createValidationErrorResponse,
  executeWithRetry,
  withErrorHandling
} from '../error-handling'

// Increase test timeout
jest.setTimeout(30000);

// Mock setTimeout to avoid actual waiting in tests
jest.useFakeTimers();

describe('Error Handling Utilities', () => {
  beforeEach(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      if (typeof callback === 'function') {
        callback();
      }
      return 1 as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isRetryableError', () => {
    test('should identify network errors as retryable', () => {
      const error = { type: ErrorType.NETWORK, message: 'Network error' }
      expect(isRetryableError(error)).toBe(true)
    })

    test('should identify timeout errors as retryable', () => {
      const error = { type: ErrorType.TIMEOUT, message: 'Timeout error' }
      expect(isRetryableError(error)).toBe(true)
    })

    test('should identify unknown errors with network-related messages as retryable', () => {
      const error = { type: ErrorType.UNKNOWN, message: 'Connection refused' }
      expect(isRetryableError(error)).toBe(true)
    })

    test('should identify Error instances with network-related messages as retryable', () => {
      const error = new Error('Connection reset')
      expect(isRetryableError(error)).toBe(true)
    })

    test('should not identify validation errors as retryable', () => {
      const error = { type: ErrorType.VALIDATION, message: 'Invalid input' }
      expect(isRetryableError(error)).toBe(false)
    })
  })

  describe('createErrorResponse', () => {
    test('should create a standard error response', () => {
      const response = createErrorResponse(
        ErrorType.NOT_FOUND,
        'Resource not found',
        { id: '123' }
      )
      
      expect(response).toEqual({
        success: false,
        error: {
          type: ErrorType.NOT_FOUND,
          message: 'Resource not found',
          details: { id: '123' }
        }
      })
    })
  })

  describe('createValidationErrorResponse', () => {
    test('should create a validation error response from Zod error', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(18)
      })
      
      let zodError: z.ZodError
      try {
        schema.parse({ name: 'Test', age: 16 })
      } catch (error) {
        zodError = error as z.ZodError
        const response = createValidationErrorResponse(zodError)
        
        expect(response.success).toBe(false)
        expect(response.error.type).toBe(ErrorType.VALIDATION)
        expect(response.error.message).toBe('Invalid parameters provided')
        expect(response.error.details).toBeDefined()
      }
    })
  })

  describe('executeWithRetry', () => {
    test('should retry failed operations', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success')
      
      const result = await executeWithRetry(mockFn, { initialDelay: 1 })
      
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(3)
    }, 10000)

    test('should stop retrying after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Network error'))
      
      await expect(executeWithRetry(mockFn, {
        maxRetries: 2,
        initialDelay: 1
      })).rejects.toThrow('Network error')
      
      expect(mockFn).toHaveBeenCalledTimes(2)
    }, 10000)

    test('should not retry non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue({ type: ErrorType.VALIDATION })
      
      await expect(executeWithRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 1
      })).rejects.toEqual({ type: ErrorType.VALIDATION })
      
      expect(mockFn).toHaveBeenCalledTimes(1)
    }, 10000)
  })

  describe('withErrorHandling', () => {
    test('should handle successful execution', async () => {
      const mockFn = jest.fn().mockResolvedValue({ success: true, data: 'test' })
      const wrappedFn = withErrorHandling(mockFn)
      
      const result = await wrappedFn({ test: 'param' })
      expect(result).toEqual({ success: true, data: 'test' })
      expect(mockFn).toHaveBeenCalledWith({ test: 'param' }, undefined)
    })

    test('should handle validation errors', async () => {
      const schema = z.object({ name: z.string() })
      const mockFn = jest.fn().mockImplementation(() => {
        throw schema.parse({ name: 123 })
      })
      
      const wrappedFn = withErrorHandling(mockFn)
      
      const result = await wrappedFn({ test: 'param' })
      expect(result).toHaveProperty('success', false)
      expect(result).toHaveProperty('error.type', ErrorType.VALIDATION)
    })

    test('should handle network errors', async () => {
      const mockFn = jest.fn().mockImplementation(() => {
        throw new Error('Network connection failed')
      })
      
      const wrappedFn = withErrorHandling(mockFn)
      
      const result = await wrappedFn({ test: 'param' })
      expect(result).toHaveProperty('success', false)
      expect(result).toHaveProperty('error.type', ErrorType.NETWORK)
    }, 10000)

    test('should retry retryable errors', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, data: 'test' })
      
      const wrappedFn = withErrorHandling(mockFn, {
        maxRetries: 2,
        initialDelay: 10
      })
      
      const result = await wrappedFn({ test: 'param' })
      expect(result).toEqual({ success: true, data: 'test' })
      expect(mockFn).toHaveBeenCalledTimes(2)
    }, 10000)
  })
})

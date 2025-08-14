import { withTimeout, withTransactionTimeout, withApiTimeout } from '../tool-timeout'

describe('Tool Timeout Utils', () => {
  describe('withTimeout', () => {
    it('should return result when function completes within timeout', async () => {
      const mockFn = jest.fn().mockResolvedValue({ success: true, data: 'test' })
      const wrappedFn = withTimeout(mockFn, { timeout: 1000, toolName: 'TestTool' })
      
      const result = await wrappedFn('arg1', 'arg2')
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result).toEqual({ success: true, data: 'test' })
    })

    it('should return timeout error response when function times out', async () => {
      const mockFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 2000))
      )
      const wrappedFn = withTimeout(mockFn, { timeout: 100, toolName: 'TestTool' })
      
      const result = await wrappedFn('arg1')
      
      expect(result).toEqual({
        _uiDisplayTool: true,
        summary: 'TestTool timed out',
        data: {
          error: 'TestTool execution timed out after 0.1 seconds. This may be due to network issues or heavy blockchain load. Please try again.',
          timeout: true,
          toolName: 'TestTool'
        }
      })
    })

    it('should return error response when function throws error', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'))
      const wrappedFn = withTimeout(mockFn, { timeout: 1000, toolName: 'TestTool' })
      
      const result = await wrappedFn('arg1')
      
      expect(result).toEqual({
        _uiDisplayTool: true,
        summary: 'TestTool failed',
        data: {
          error: 'Test error',
          timeout: false,
          toolName: 'TestTool'
        }
      })
    })
  })

  describe('withTransactionTimeout', () => {
    it('should use 30 second timeout for transaction tools', async () => {
      const mockFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 31000))
      )
      const wrappedFn = withTransactionTimeout(mockFn, 'TransactionTool')
      
      const result = await wrappedFn()
      
      expect(result).toEqual({
        _uiDisplayTool: true,
        summary: 'TransactionTool timed out',
        data: {
          error: 'TransactionTool execution timed out after 30 seconds. This may be due to network issues or heavy blockchain load. Please try again.',
          timeout: true,
          toolName: 'TransactionTool'
        }
      })
    }, 35000)
  })

  describe('withApiTimeout', () => {
    it('should use 15 second timeout for API tools', async () => {
      const mockFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 16000))
      )
      const wrappedFn = withApiTimeout(mockFn, 'ApiTool')
      
      const result = await wrappedFn()
      
      expect(result).toEqual({
        _uiDisplayTool: true,
        summary: 'ApiTool timed out',
        data: {
          error: 'ApiTool execution timed out after 15 seconds. This may be due to network issues or heavy blockchain load. Please try again.',
          timeout: true,
          toolName: 'ApiTool'
        }
      })
    }, 20000)
  })
})
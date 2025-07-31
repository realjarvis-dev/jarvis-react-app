import { getEnsoClient, getSimulationService, getStrategyBuilder } from '@/lib/enso'

// Mock environment variables for testing
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    ENSO_API_KEY: 'test-api-key',
    NEXT_PUBLIC_ENSO_API_KEY: 'test-public-api-key'
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('Enso Integration', () => {
  describe('Service Initialization', () => {
    it('should initialize Enso client without errors', () => {
      expect(() => {
        const client = getEnsoClient()
        expect(client).toBeDefined()
      }).not.toThrow()
    })

    it('should initialize simulation service without errors', () => {
      expect(() => {
        const service = getSimulationService()
        expect(service).toBeDefined()
      }).not.toThrow()
    })

    it('should initialize strategy builder without errors', () => {
      expect(() => {
        const builder = getStrategyBuilder()
        expect(builder).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('API Configuration', () => {
    it('should have required environment variables configured', () => {
      // These should be set in .env.local for the integration to work
      expect(process.env.ENSO_API_KEY || process.env.NEXT_PUBLIC_ENSO_API_KEY).toBeDefined()
    })

    it('should have singleton pattern working', () => {
      const client1 = getEnsoClient()
      const client2 = getEnsoClient()
      expect(client1).toBe(client2) // Should be the same instance

      const service1 = getSimulationService()
      const service2 = getSimulationService()
      expect(service1).toBe(service2) // Should be the same instance

      const builder1 = getStrategyBuilder()
      const builder2 = getStrategyBuilder()
      expect(builder1).toBe(builder2) // Should be the same instance
    })
  })
})
export const tool = jest.fn((config: any) => {
  return {
    ...config,
    parameters: config.parameters
  }
})

export const generateId = jest.fn(() => 'mock-id')

export const generateText = jest.fn(async () => ({
  text: '<tool_call><tool>search</tool><parameters><query>test query</query></parameters></tool_call>'
}))

export const createProviderRegistry = jest.fn((providers: any) => {
  return {
    languageModel: jest.fn((model: string) => ({
      generateText
    }))
  }
})

export const extractReasoningMiddleware = jest.fn((config: any) => ({}))

export const wrapLanguageModel = jest.fn((config: any) => config.model)

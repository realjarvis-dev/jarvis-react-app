export const getModel = jest.fn().mockReturnValue('mock-model')
export const isToolCallSupported = jest.fn().mockImplementation((model?: string) => {
  if (model?.includes('openai')) {
    return true
  }
  return false
})
export const getToolCallModel = jest.fn().mockReturnValue('mock-model')
export const isReasoningModel = jest.fn().mockReturnValue(false)

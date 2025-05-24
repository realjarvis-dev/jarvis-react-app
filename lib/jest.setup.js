// Mock modules that can't be mocked with jest.mock in Bun
global.mockRegistry = {
  getModel: jest.fn().mockReturnValue('mock-model'),
  isToolCallSupported: jest.fn().mockReturnValue(false)
}

global.mockAI = {
  generateText: jest.fn().mockResolvedValue({
    text: '<tool_call><tool>search</tool><parameters><query>test query</query></parameters></tool_call>'
  }),
  generateId: jest.fn().mockReturnValue('mock-id')
}

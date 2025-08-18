# ChainGPT Web3 Agent Integration

This document describes the implementation of the ChainGPT Web3 agent as a tool for handling Web3 domain-related questions in the Jarvis investment agent.

## Overview

The ChainGPT Web3 agent provides expert-level knowledge and guidance on Web3, DeFi, blockchain, and cryptocurrency topics. It leverages ChainGPT's specialized AI model to deliver contextually relevant, domain-specific responses with customizable parameters for different user experience levels and use cases.

## Features

### Core Capabilities
- **Expert Web3 Knowledge**: Specialized AI trained on Web3, DeFi, and blockchain concepts
- **Domain-Specific Focus**: Targeted responses for DeFi, NFTs, trading, development, security, and general Web3
- **Adaptive Response Types**: Comprehensive, concise, technical, or beginner-friendly explanations
- **User Level Awareness**: Tailored responses for beginner, intermediate, and advanced users
- **Context Injection**: Custom context and company-specific information
- **Chat History**: Optional conversation history saving and retrieval
- **Streaming Support**: Real-time response streaming for interactive experiences

### Response Customization
- **Tone Control**: Professional, friendly, technical, or educational tone
- **Example Inclusion**: Optional practical examples and use cases
- **Enhanced Prompting**: Intelligent prompt construction based on user intent
- **Multi-Domain Support**: Specialized knowledge across Web3 verticals

## Implementation

### File Structure
```
lib/
├── tools/
│   └── chaingpt-web3-agent.ts          # Main tool implementation
├── types/
│   └── chaingpt.ts                     # TypeScript types and interfaces
└── utils/
    └── tool-registry.ts                # Tool registration

components/
└── chaingpt-web3-section.tsx           # UI components for displaying responses

tests/
└── chaingpt-web3-agent.test.ts         # Comprehensive test suite
```

### Core Components

#### 1. ChainGPT Web3 Agent Tool (`lib/tools/chaingpt-web3-agent.ts`)

The main tool implementation provides two primary functions:

**`chainGPTWeb3AgentTool`** - Standard response tool
- Parameters: question, context, response_type, domain_focus, include_examples, tone, save_history, user_level
- Returns: Structured response with metadata and enhanced prompts

**`chainGPTWeb3AgentStreamTool`** - Streaming response tool
- Parameters: question, context, domain_focus, tone, user_level
- Returns: Stream metadata for real-time response handling

#### 2. Type Definitions (`lib/types/chaingpt.ts`)

Comprehensive TypeScript interfaces for:
- Response structures (`ChainGPTWeb3Response`, `ChainGPTStreamResponse`)
- Chat history management (`ChainGPTChatHistory`, `ChainGPTHistoryItem`)
- Context injection (`ChainGPTContextInjection`)
- Domain-specific analysis types
- UI component props

#### 3. UI Components (`components/chaingpt-web3-section.tsx`)

React components for displaying ChainGPT responses:
- **`ChainGPTWeb3Section`**: Main response display with metadata badges
- **`ChainGPTStreamSection`**: Streaming response display with real-time indicators
- Domain-specific icons and color coding
- Copy functionality and history saving options

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# ChainGPT API Configuration
CHAINGPT_API_KEY=your_chaingpt_api_key_here
```

### API Key Setup

1. Visit the [ChainGPT AI Hub](https://app.chaingpt.org/)
2. Create an account and navigate to the API Dashboard
3. Generate a secret API key using the "Create Secret Key" feature
4. Add the key to your environment variables
5. Ensure your account has sufficient credits for API calls

### Credit Usage

- **Standard Response**: 0.5 credits per request
- **With History Enabled**: 1.0 credits per request (0.5 + 0.5 for history)
- **Rate Limit**: 200 requests per minute per API key

## Usage Examples

### Basic Usage

```typescript
import { chainGPTWeb3AgentTool } from '@/lib/tools/chaingpt-web3-agent'

// Simple question
const result = await chainGPTWeb3AgentTool.execute({
  question: 'What is DeFi and how does it work?'
}, context)

console.log(result.response) // AI-generated explanation
```

### Advanced Usage with Context

```typescript
// Domain-specific question with context
const result = await chainGPTWeb3AgentTool.execute({
  question: 'How do I provide liquidity to Uniswap?',
  context: 'User is new to DeFi and wants to understand risks',
  domain_focus: 'defi',
  response_type: 'beginner_friendly',
  user_level: 'beginner',
  tone: 'educational',
  include_examples: true,
  save_history: true
}, context)
```

### Streaming Response

```typescript
import { chainGPTWeb3AgentStreamTool } from '@/lib/tools/chaingpt-web3-agent'

const streamResult = await chainGPTWeb3AgentStreamTool.execute({
  question: 'Explain smart contract security best practices',
  domain_focus: 'security',
  user_level: 'advanced',
  tone: 'technical'
}, context)
```

### Chat History Management

```typescript
import { getChainGPTChatHistory } from '@/lib/tools/chaingpt-web3-agent'

// Retrieve conversation history
const history = await getChainGPTChatHistory('session-id', 10)
console.log(history.history) // Array of previous conversations
```

## Tool Registry Integration

The tools are automatically registered in the tool registry with the following configurations:

```typescript
// Standard Web3 Agent Tool
{
  name: 'chaingpt_web3_agent',
  description: 'Use ChainGPT Web3 AI agent to answer complex Web3, DeFi, blockchain, and cryptocurrency questions',
  category: ToolCategory.WEB,
  schema: chainGPTWeb3AgentTool.parameters
}

// Streaming Web3 Agent Tool
{
  name: 'chaingpt_web3_agent_stream',
  description: 'Use ChainGPT Web3 AI agent with streaming responses for real-time Web3/DeFi guidance',
  category: ToolCategory.WEB,
  schema: chainGPTWeb3AgentStreamTool.parameters
}
```

## Parameters Reference

### Standard Tool Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `question` | string | required | The Web3/DeFi/blockchain question to ask |
| `context` | string | optional | Additional context about user's situation |
| `response_type` | enum | 'comprehensive' | Type of response: comprehensive, concise, technical, beginner_friendly |
| `domain_focus` | enum | optional | Specific domain: defi, nft, trading, development, security, general_web3 |
| `include_examples` | boolean | true | Whether to include practical examples |
| `tone` | enum | 'professional' | Response tone: professional, friendly, technical, educational |
| `save_history` | boolean | false | Whether to save conversation for future reference |
| `user_level` | enum | 'intermediate' | User experience level: beginner, intermediate, advanced |

### Streaming Tool Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `question` | string | required | The Web3/DeFi/blockchain question to ask |
| `context` | string | optional | Additional context about user's situation |
| `domain_focus` | enum | optional | Specific Web3 domain to focus on |
| `tone` | enum | 'professional' | Response tone |
| `user_level` | enum | 'intermediate' | User experience level |

## Response Structure

### Standard Response

```typescript
interface ChainGPTWeb3Response {
  response: string                    // AI-generated response
  timestamp: string                   // ISO timestamp
  source: 'ChainGPT Web3 AI'        // Response source
  context?: string                    // Original context if provided
  error?: string                      // Error message if failed
  question: string                    // Original question
  response_type?: string              // Type of response generated
  domain_focus?: string               // Domain focus used
  user_level?: string                 // User level considered
  session_id?: string                 // Session ID if history enabled
  metadata?: {
    tone: string                      // Tone used
    include_examples: boolean         // Whether examples included
    save_history: boolean             // Whether history saved
    enhanced_prompt: string           // Full prompt sent to AI
  }
}
```

### Streaming Response

```typescript
interface ChainGPTStreamResponse {
  stream_initiated: boolean           // Whether stream started successfully
  question: string                    // Original question
  domain_focus?: string               // Domain focus
  user_level?: string                 // User level
  tone: string                        // Response tone
  timestamp: string                   // ISO timestamp
  source: 'ChainGPT Web3 AI (Streaming)' // Response source
  enhanced_prompt?: string            // Enhanced prompt used
  error?: string                      // Error message if failed
}
```

## Error Handling

The implementation includes comprehensive error handling:

1. **API Key Validation**: Checks for required environment variables
2. **Graceful Degradation**: Returns structured error responses instead of throwing
3. **Network Error Handling**: Handles API connectivity issues
4. **Rate Limit Management**: Respects ChainGPT's rate limiting
5. **Credit Monitoring**: Fails gracefully when credits are insufficient

## Testing

The implementation includes a comprehensive test suite covering:

- Basic parameter validation
- Domain-specific question handling
- Context injection functionality
- History saving and retrieval
- Error handling scenarios
- Enhanced prompt construction
- Schema validation

Run tests with:
```bash
npm test tests/chaingpt-web3-agent.test.ts
```

## UI Integration

The UI components provide:

- **Rich Response Display**: Formatted markdown with syntax highlighting
- **Metadata Badges**: Visual indicators for domain, user level, and response type
- **Copy Functionality**: Easy copying of responses
- **History Management**: Save and retrieve conversation history
- **Loading States**: Proper loading indicators for async operations
- **Error States**: User-friendly error displays
- **Streaming Support**: Real-time response display

## Best Practices

### For Developers

1. **Always validate API key availability** before making requests
2. **Use appropriate user levels** based on user's Web3 experience
3. **Provide context** when possible for more relevant responses
4. **Handle errors gracefully** with user-friendly messages
5. **Monitor credit usage** to avoid service interruptions
6. **Use streaming for interactive experiences** where appropriate

### For Users

1. **Be specific in questions** for better targeted responses
2. **Provide context** about your experience level and goals
3. **Use domain focus** when asking about specific Web3 areas
4. **Enable history** for follow-up questions and continuity
5. **Choose appropriate response types** based on your needs

## Security Considerations

1. **API Key Protection**: Never expose API keys in client-side code
2. **Environment Variables**: Store sensitive configuration securely
3. **Rate Limiting**: Implement client-side rate limiting if needed
4. **Data Privacy**: Be mindful of sensitive information in questions
5. **History Management**: Consider privacy implications of saved conversations

## Troubleshooting

### Common Issues

1. **"API key not set" error**: Ensure `CHAINGPT_API_KEY` is in environment variables
2. **Rate limit exceeded**: Wait before making additional requests
3. **Insufficient credits**: Top up credits in ChainGPT dashboard
4. **Network timeouts**: Implement retry logic with exponential backoff
5. **Invalid parameters**: Check parameter types and enum values

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=chaingpt:*
```

## Future Enhancements

Potential improvements and extensions:

1. **Multi-language Support**: Responses in different languages
2. **Custom Context Templates**: Pre-defined context templates for common use cases
3. **Response Caching**: Cache responses for common questions
4. **Analytics Integration**: Track usage patterns and popular topics
5. **Feedback System**: Allow users to rate response quality
6. **Integration with Other Tools**: Combine with price data, news, etc.
7. **Voice Interface**: Audio input/output capabilities
8. **Mobile Optimization**: Enhanced mobile UI components

## Contributing

When contributing to the ChainGPT Web3 agent:

1. Follow existing code patterns and TypeScript types
2. Add comprehensive tests for new features
3. Update documentation for any API changes
4. Consider backward compatibility
5. Test with various parameter combinations
6. Validate error handling scenarios

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review ChainGPT API documentation
3. Test with minimal examples to isolate issues
4. Check environment variable configuration
5. Verify API key permissions and credit balance

## License

This implementation is part of the Jarvis investment agent project and follows the same licensing terms.

import { z } from 'zod'

export interface ToolCall<T = unknown> {
  tool: string
  parameters?: T
}

function getTagContent(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'))
  return match ? match[1].trim() : ''
}

export function parseToolCallXml<T>(
  xml: string,
  schema?: z.ZodType<T>
): ToolCall<T> {
  const toolCallContent = getTagContent(xml, 'tool_call')
  if (!toolCallContent) {
    console.warn('No tool_call tag found in response')
    return { tool: '' }
  }

  const tool = getTagContent(toolCallContent, 'tool')
  if (!tool) return { tool: '' }

  const parametersXml = getTagContent(toolCallContent, 'parameters')
  if (!parametersXml || !schema) return { tool }

  try {
    // Extract all parameter values using tag names from schema
    const rawParameters: Record<string, string> = {}
    if (schema && schema instanceof z.ZodObject && schema.shape) {
      Object.keys(schema.shape).forEach(key => {
        const value = getTagContent(parametersXml, key)
        if (value) rawParameters[key] = value
      })
    }

    if (rawParameters.reasoning && Object.keys(rawParameters).length === 1) {
      if (schema) {
        const parameters = schema.parse({
          reasoning: rawParameters.reasoning
        })
        return { tool, parameters }
      }
    }

    // Parse parameters using the provided schema
    const processedParameters: Record<string, any> = { ...rawParameters }
    
    if (rawParameters.include_domains) {
      processedParameters.include_domains = rawParameters.include_domains
        .split(',')
        .map(d => d.trim())
        .filter(Boolean)
    }
    if (rawParameters.exclude_domains) {
      processedParameters.exclude_domains = rawParameters.exclude_domains
        .split(',')
        .map(d => d.trim())
        .filter(Boolean)
    }
    if (rawParameters.max_results) {
      processedParameters.max_results = parseInt(rawParameters.max_results, 10)
    }
    
    if (rawParameters.preferred_protocols) {
      try {
        processedParameters.preferred_protocols = JSON.parse(rawParameters.preferred_protocols)
      } catch {
        processedParameters.preferred_protocols = rawParameters.preferred_protocols
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
      }
    }
    
    const parameters = schema.parse(processedParameters)

    return { tool, parameters }
  } catch (error) {
    console.error('Failed to parse parameters:', error)
    return { tool }
  }
}

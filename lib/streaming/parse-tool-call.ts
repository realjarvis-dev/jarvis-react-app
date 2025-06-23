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
    console.log('Debug - parametersXml content:', parametersXml)
    console.log('Debug - schema type:', typeof schema)
    console.log('Debug - schema instanceof z.ZodObject:', schema instanceof z.ZodObject)
    console.log('Debug - schema shape keys:', schema && schema instanceof z.ZodObject ? Object.keys(schema.shape) : 'No schema shape')
    console.log('Debug - full schema object:', schema)
    
    // Extract all parameter values using tag names from schema
    let rawParameters: Record<string, string> = {}
    
    if (parametersXml.trim().startsWith('{') && parametersXml.trim().endsWith('}')) {
      try {
        const jsonParams = JSON.parse(parametersXml)
        console.log('Debug - parsed JSON parameters:', jsonParams)
        
        if (jsonParams.goal || jsonParams.userGoal || jsonParams.user_preferences || jsonParams.strategy_type) {
          rawParameters.investment_goal = jsonParams.goal || jsonParams.userGoal || jsonParams.user_preferences || `${jsonParams.strategy_type} strategy`
          console.log('Debug - mapped investment_goal:', rawParameters.investment_goal)
        }
        if (jsonParams.capital) {
          rawParameters.available_capital = jsonParams.capital
          console.log('Debug - mapped available_capital from capital:', rawParameters.available_capital)
        } else if (jsonParams.amount && jsonParams.token) {
          rawParameters.available_capital = `${jsonParams.amount} ${jsonParams.token}`
          console.log('Debug - mapped available_capital from amount+token:', rawParameters.available_capital)
        } else if (jsonParams.amount) {
          rawParameters.available_capital = jsonParams.amount
          console.log('Debug - mapped available_capital from amount:', rawParameters.available_capital)
        }
        if (jsonParams.risk_tolerance || jsonParams.riskTolerance || jsonParams.risk_level) {
          const riskValue = jsonParams.risk_tolerance || jsonParams.riskTolerance || jsonParams.risk_level
          if (riskValue === 'balanced' || riskValue === 'moderate') {
            rawParameters.risk_tolerance = 'medium'
          } else if (riskValue === 'conservative' || riskValue === 'low') {
            rawParameters.risk_tolerance = 'low'
          } else if (riskValue === 'aggressive' || riskValue === 'high') {
            rawParameters.risk_tolerance = 'high'
          } else {
            rawParameters.risk_tolerance = riskValue
          }
          console.log('Debug - mapped risk_tolerance:', rawParameters.risk_tolerance)
        }
        if (jsonParams.time_horizon || jsonParams.timeHorizon) {
          const timeHorizon = (jsonParams.time_horizon || jsonParams.timeHorizon || '').toLowerCase()
          console.log('Debug - processing timeHorizon:', timeHorizon)
          if (timeHorizon.includes('month') && (timeHorizon.includes('1') || timeHorizon.includes('2') || timeHorizon.includes('3'))) {
            rawParameters.time_horizon = 'short'
          } else if (timeHorizon.includes('month') && (timeHorizon.includes('6') || timeHorizon.includes('12'))) {
            rawParameters.time_horizon = 'medium'
          } else if (timeHorizon.includes('year') || timeHorizon.includes('long')) {
            rawParameters.time_horizon = 'long'
          } else if (timeHorizon.includes('flexible')) {
            rawParameters.time_horizon = 'medium' // default for flexible
          } else {
            rawParameters.time_horizon = 'medium' // default
          }
        }
        if (jsonParams.preferred_protocols) {
          rawParameters.preferred_protocols = Array.isArray(jsonParams.preferred_protocols) 
            ? JSON.stringify(jsonParams.preferred_protocols)
            : jsonParams.preferred_protocols
        } else {
          rawParameters.preferred_protocols = '[]' // empty array default
        }
        
        Object.keys(jsonParams).forEach(key => {
          console.log(`Debug - processing JSON key: ${key}, value:`, jsonParams[key])
          
          if (key === 'strategy_plan' || key === 'strategyPlan' || key === 'plan') {
            rawParameters.strategy_plan = JSON.stringify(jsonParams[key])
            console.log('Debug - mapped strategy_plan:', rawParameters.strategy_plan)
          }
          
          if (key === 'user_wallet_address' || key === 'userWalletAddress' || key === 'wallet_address' || key === 'walletAddress') {
            rawParameters.user_wallet_address = jsonParams[key]
            console.log('Debug - mapped user_wallet_address:', rawParameters.user_wallet_address)
          }
          
          if (key === 'execute_immediately' || key === 'executeImmediately' || key === 'execute' || key === 'immediate') {
            rawParameters.execute_immediately = String(jsonParams[key])
            console.log('Debug - mapped execute_immediately:', rawParameters.execute_immediately)
          }
        })
      } catch (jsonError) {
        console.error('Failed to parse JSON parameters:', jsonError)
      }
    } else {
      if (schema && schema instanceof z.ZodObject && schema.shape) {
        Object.keys(schema.shape).forEach(key => {
          const value = getTagContent(parametersXml, key)
          console.log(`Debug - extracting ${key}: "${value}"`)
          if (value) rawParameters[key] = value
        })
      }
    }
    
    console.log('Debug - final rawParameters after all processing:', rawParameters)
    console.log('Debug - rawParameters keys:', Object.keys(rawParameters))
    console.log('Debug - rawParameters values:', Object.values(rawParameters))

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
    
    if (rawParameters.investment_goal) {
      processedParameters.investment_goal = rawParameters.investment_goal
    }
    if (rawParameters.available_capital) {
      processedParameters.available_capital = rawParameters.available_capital
    }
    if (rawParameters.risk_tolerance) {
      processedParameters.risk_tolerance = rawParameters.risk_tolerance
    }
    if (rawParameters.time_horizon) {
      processedParameters.time_horizon = rawParameters.time_horizon
    }
    
    if (rawParameters.strategy_plan) {
      try {
        processedParameters.strategy_plan = JSON.parse(rawParameters.strategy_plan)
        console.log('Debug - parsed strategy_plan object:', processedParameters.strategy_plan)
      } catch {
        processedParameters.strategy_plan = rawParameters.strategy_plan
        console.log('Debug - using raw strategy_plan:', processedParameters.strategy_plan)
      }
    }
    if (rawParameters.user_wallet_address) {
      processedParameters.user_wallet_address = rawParameters.user_wallet_address
    }
    if (rawParameters.execute_immediately) {
      processedParameters.execute_immediately = rawParameters.execute_immediately === 'true'
    }
    
    console.log('Debug - processedParameters before schema.parse:', processedParameters)
    console.log('Debug - schema._def keys:', schema._def ? Object.keys(schema._def) : 'No _def')
    console.log('Debug - schema typeName:', (schema as any)._def?.typeName)
    
    try {
      console.log('Debug - about to call schema.safeParse with:', processedParameters)
      console.log('Debug - schema shape:', schema instanceof z.ZodObject ? Object.keys(schema.shape) : 'Not ZodObject')
      
      const parseResult = schema.safeParse(processedParameters)
      console.log('Debug - safeParse result:', parseResult)
      console.log('Debug - parseResult.success:', parseResult.success)
      console.log('Debug - parseResult.data:', parseResult.data)
      
      if (parseResult.success) {
        const parameters = parseResult.data
        console.log('Debug - parameters after successful parse:', parameters)
        console.log('Debug - typeof parameters:', typeof parameters)
        console.log('Debug - Object.keys(parameters):', Object.keys(parameters))
        
        if (Object.keys(parameters).length === 0 && Object.keys(processedParameters).length > 0) {
          console.log('Debug - schema returned empty object, using processedParameters as fallback')
          return { tool, parameters: processedParameters as any }
        }
        
        return { tool, parameters }
      } else {
        console.log('Debug - parse errors:', parseResult.error.errors)
        console.log('Debug - using fallback parameters:', processedParameters)
        return { tool, parameters: processedParameters as any }
      }
    } catch (parseError) {
      console.log('Debug - parse exception:', parseError)
      return { tool, parameters: processedParameters as any }
    }
  } catch (error) {
    console.error('Failed to parse parameters:', error)
    return { tool }
  }
}

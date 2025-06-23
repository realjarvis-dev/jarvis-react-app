import {
  CoreMessage,
  DataStreamWriter
} from 'ai'
import { executeToolCall as dualModelExecuteToolCall } from '../tools/execute-tool-call'

interface ToolExecutionResult {
  toolCallDataAnnotation: any
  toolCallMessages: CoreMessage[]
}

export async function executeToolCall(
  coreMessages: CoreMessage[],
  dataStream: DataStreamWriter,
  model: string,
  searchMode: boolean,
  isNewUser?: boolean
): Promise<ToolExecutionResult> {
  return await dualModelExecuteToolCall(coreMessages, dataStream, searchMode, isNewUser || false)
}

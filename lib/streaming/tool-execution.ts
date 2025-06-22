import {
  CoreMessage,
  DataStreamWriter
} from 'ai'
import { executeToolCall as unifiedExecuteToolCall } from './unified-tool-execution'

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
  return await unifiedExecuteToolCall(coreMessages, dataStream, model, searchMode, isNewUser)
}

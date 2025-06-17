import { ToolInvocation } from "ai";
import { ToolArgsSection } from "./section";
import { CHAT_ID } from "@/lib/constants";
import { useChat } from '@ai-sdk/react'

interface GetGasPriceSectionProps {
  tool: ToolInvocation
}

export function GetGasPriceSection({ tool }: GetGasPriceSectionProps) {
    const { status } = useChat({
        id: CHAT_ID
      })
    const isLoading = status === 'submitted' || status === 'streaming'
    const isToolLoading = tool.state === 'call'
    const result = tool.state === 'result' ? tool.result : undefined
    if ((isLoading || isToolLoading) && !result) {
        return (
            <ToolArgsSection tool="get_gas_price">
                <div>
                    <p>Fetching latest gas price from Blocknative...</p>
                </div>
            </ToolArgsSection>
        )
    }

    if (!result) {
        return null
    }

    

    return (
        <ToolArgsSection tool="get_gas_price">
    <div>
      <p>
        Fetched gas price {result.chainName && ("for " + result.chainName)} from Blocknative at {new Date(result.complete_time).toLocaleString()}
      </p>
    </div>
  </ToolArgsSection>
  )
}
'use client'

import { useNetwork } from '@/lib/network/context'
import { normalizeSwapInfo } from './swap/swap-execution-adapter'
import { UnifiedSwapExecutionCard } from './swap/unified-swap-execution-card'

interface LifiSwapExecuteSectionProps {
  tool: any // AI tool invocation, specifically bridgeExecuteTool
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function LifiSwapExecuteSection({
  tool,
  isOpen,
  onOpenChange
}: LifiSwapExecuteSectionProps) {
  const { activeNetwork } = useNetwork()
  const normalizedInfo = normalizeSwapInfo(tool, activeNetwork.chainId)

  return (
    <UnifiedSwapExecutionCard
      tool={tool}
      normalizedInfo={normalizedInfo}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  )
}

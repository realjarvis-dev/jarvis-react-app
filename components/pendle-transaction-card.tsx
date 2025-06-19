'use client'

import { useNetwork } from '@/lib/network/context'
import { normalizeSwapInfo } from './swap/swap-execution-adapter'
import { UnifiedSwapExecutionCard } from './swap/unified-swap-execution-card'

interface PendleTransactionCardProps {
  tool: any
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PendleTransactionCard({
  tool,
  isOpen,
  onOpenChange
}: PendleTransactionCardProps) {
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
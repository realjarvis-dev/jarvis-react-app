import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import React from 'react'

interface WithTooltipProps {
  children: React.ReactNode
  tooltipText: string
}

export function WithTooltip({ children, tooltipText }: WithTooltipProps) {
  return (
    <div className="flex items-center gap-1">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex cursor-pointer items-center border-none bg-transparent p-0 text-current hover:opacity-80"
          >
            <Info className="size-3 sm:size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
